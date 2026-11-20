<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Jobs\CheckTransactionDocument;
use App\Services\FileService;
use App\Services\Trading\BuyRules;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Selling step 1 (was prepareSellUploads + submitSellVehicle in my-transactions/actions.ts). The browser
 * gets upload grants for one new transaction id, stores each file through POST /trading/uploads, then
 * submits the offer with the granted paths. Route group: role = customer.
 */
class SellIntakeController extends Controller
{
    private const BUCKET = 'transaction-documents';

    private const PHOTO_MAX = 6;

    private const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    private const EXTENSIONS = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];

    private const ATTACHMENTS = ['sell_photo', 'issue_photo'];

    /** SN-11 / SN-13: an offer uploads only the two IDs (front and back) and its photos. The OR, the CR and the
     * deed of sale are declared on the checklist and checked against the originals at the meet-up. */
    private const PAPERS = ['valid_id', 'valid_id', 'valid_id', 'valid_id'];

    private const PAPERS_MESSAGE = 'Attach both valid IDs (front and back) with their ID types.';

    /** The papers a seller declares, and the answers each one accepts (SN-13). */
    private const PAPER_STATUSES = [
        'official_receipt' => ['has', 'does_not_have', 'expired'],
        'certificate_of_registration' => ['has', 'does_not_have', 'expired'],
        // A deed of sale is a contract, so it cannot expire: it was either signed or never existed.
        'deed_of_sale' => ['has', 'does_not_have'],
    ];

    private const CHECKLIST_MESSAGE = 'Answer the papers checklist for the OR, the CR and the deed of sale.';

    /**
     * SN-13: the seller's answers as one object. The browser sends it as JSON (like condition_items), so both forms
     * are read. An absent checklist is refused: a new offer must answer it.
     */
    private static function papersChecklist(mixed $raw): array
    {
        $decoded = is_string($raw) ? json_decode($raw, true) : $raw;
        abort_unless(is_array($decoded), 422, self::CHECKLIST_MESSAGE);
        $checklist = [];
        foreach (self::PAPER_STATUSES as $kind => $allowed) {
            $status = $decoded[$kind] ?? null;
            abort_unless(is_string($status) && in_array($status, $allowed, true), 422, self::CHECKLIST_MESSAGE);
            $checklist[$kind] = $status;
        }

        return $checklist;
    }

    private static function prefix(string $transactionId, string $kind): string
    {
        return $transactionId.'/'.str_replace('_', '-', $kind).'-';
    }

    /** sellFilesError: photos first, then the papers in PAPERS order, then any issue photos. */
    private static function filesError(array $files): ?string
    {
        $kinds = array_column($files, 'kind');
        $photos = array_filter($kinds, fn ($k) => $k === 'sell_photo');
        $issues = array_filter($kinds, fn ($k) => $k === 'issue_photo');
        $papers = array_values(array_filter($kinds, fn ($k) => ! in_array($k, self::ATTACHMENTS, true)));
        if (count($photos) === 0) {
            return 'At least one vehicle photo is required.';
        }
        if (count($photos) > self::PHOTO_MAX) {
            return 'You can upload at most '.self::PHOTO_MAX.' photos.';
        }
        if (count($issues) > self::PHOTO_MAX) {
            return 'You can upload at most '.self::PHOTO_MAX.' issue photos.';
        }
        if ($papers !== self::PAPERS) {
            return self::PAPERS_MESSAGE;
        }
        foreach ($files as $file) {
            if (in_array($file['kind'], self::ATTACHMENTS, true) && ! in_array($file['type'], self::PHOTO_TYPES, true)) {
                return 'Photos must be JPEG, PNG, or WebP images.';
            }
            if (! isset(self::EXTENSIONS[$file['type']])) {
                return 'Papers must be JPEG, PNG, WebP or PDF files.';
            }
            if ($file['size'] <= 0 || $file['size'] > FileService::MAX_BYTES) {
                return 'Each file must be 2 MB or smaller.';
            }
        }

        return null;
    }

    /** POST /trading/sell/prepare-uploads: one grant per file, valid for 15 minutes. */
    public function prepareUploads(Request $request): JsonResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'max:40'],
            'files.*.kind' => ['required', 'in:sell_photo,valid_id,issue_photo'],
            'files.*.type' => ['required', 'string'],
            'files.*.size' => ['required', 'integer'],
        ]);
        $files = $request->input('files');
        $error = self::filesError($files);
        abort_if($error !== null, 422, $error ?? '');
        $transactionId = (string) Str::uuid();
        $expires = time() + 900;
        $uploads = [];
        foreach ($files as $file) {
            $path = self::prefix($transactionId, $file['kind']).now()->getTimestampMs().'-'.Str::lower(Str::random(6)).'.'.self::EXTENSIONS[$file['type']];
            $uploads[] = ['path' => $path, 'token' => $expires.'.'.hash_hmac('sha256', "{$request->user()->id}|{$path}|{$expires}", (string) config('app.key'))];
        }

        return response()->json(['transactionId' => $transactionId, 'uploads' => $uploads]);
    }

    /** POST /trading/sell: creates the sell transaction, its details, documents, draft vehicle and thread. */
    public function submit(Request $request, FileService $files): JsonResponse
    {
        $data = $request->validate([
            'make' => ['required', 'string', 'max:100'], 'model' => ['required', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:1980', 'max:'.((int) date('Y') + 1)],
            'mileage' => ['required', 'integer', 'min:0'],
            'condition' => ['required', 'in:Like New,Good,Fair'],
            'offered_amount' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:2000'],
            'has_known_issues' => ['required', 'in:yes,no'],
            'declared_issues' => ['nullable', 'string', 'max:2000'],
            'meetup_method' => ['required', 'in:meet_halfway,gce_visit'],
            'meetup_lat' => ['nullable', 'numeric', 'between:-90,90'],
            'meetup_lng' => ['nullable', 'numeric', 'between:-180,180'],
            // BH-8: the Region/Province/City/Barangay + typed block and lot, composed by the browser.
            'meetup_address' => ['nullable', 'string', 'max:500'],
            'owner_number' => ['required', 'in:1,2,3,4'],
            'transaction_id' => ['required', 'uuid'],
            // SN-13: the three papers are declared, not uploaded, so the JSON answers are required.
            'papers_checklist' => ['required'],
            'id_type_1' => ['required', 'in:'.implode(',', CustomerTradingController::ID_TYPES)],
            'id_type_2' => ['required', 'in:'.implode(',', CustomerTradingController::ID_TYPES)],
        ], ['transaction_id.*' => 'Invalid upload. Please try again.', 'id_type_1.*' => 'Choose the type of both valid IDs.', 'id_type_2.*' => 'Choose the type of both valid IDs.', 'papers_checklist.required' => self::CHECKLIST_MESSAGE]);
        abort_if($data['id_type_1'] === $data['id_type_2'], 422, 'Use two different valid IDs.');
        $papersChecklist = self::papersChecklist($request->input('papers_checklist'));
        abort_if($data['has_known_issues'] === 'yes' && trim((string) ($data['declared_issues'] ?? '')) === '', 422, 'Tick the issues, or tick Others and describe them.');
        $halfway = $data['meetup_method'] === 'meet_halfway';
        abort_if($halfway && (! isset($data['meetup_lat'], $data['meetup_lng'])), 422, 'Set the meet-up point on the map.');
        // SH-14: a halfway pin outside the CALABARZON box is refused, whatever the browser sent.
        abort_if($halfway && ! BuyRules::isInCalabarzon($data['meetup_lat'], $data['meetup_lng']), 422, BuyRules::OUTSIDE_CALABARZON_MESSAGE);
        $meetupAddress = $halfway ? trim((string) ($data['meetup_address'] ?? '')) : '';
        $transactionId = $data['transaction_id'];
        $userId = $request->user()->id;

        // The granted paths (prepareUploads), in the order the old action read them. Each must exist on the disk.
        $path = function (mixed $value, string $kind) use ($transactionId, $files): ?string {
            return is_string($value) && str_starts_with($value, self::prefix($transactionId, $kind)) && $files->exists(self::BUCKET, $value) ? $value : null;
        };
        $uploads = [];
        $photos = (array) $request->input('photo_paths', []);
        abort_if(count($photos) === 0, 422, 'At least one vehicle photo is required.');
        abort_if(count($photos) > self::PHOTO_MAX, 422, 'You can upload at most '.self::PHOTO_MAX.' photos.');
        foreach ($photos as $value) {
            $p = $path($value, 'sell_photo');
            abort_unless($p, 422, 'Invalid vehicle photo.');
            $uploads[] = ['path' => $p, 'kind' => 'sell_photo', 'id_type' => null, 'id_side' => null];
        }
        foreach ([1, 2] as $n) {
            foreach (['front', 'back'] as $side) {
                $p = $path($request->input("id_{$side}_path_{$n}"), 'valid_id');
                abort_unless($p, 422, self::PAPERS_MESSAGE);
                $uploads[] = ['path' => $p, 'kind' => 'valid_id', 'id_type' => $data["id_type_{$n}"], 'id_side' => $side];
            }
        }
        $issues = (array) $request->input('issue_photo_paths', []);
        abort_if(count($issues) > self::PHOTO_MAX, 422, 'You can upload at most '.self::PHOTO_MAX.' issue photos.');
        foreach ($issues as $value) {
            $p = $path($value, 'issue_photo');
            abort_unless($p, 422, 'Invalid issue photo.');
            $uploads[] = ['path' => $p, 'kind' => 'issue_photo', 'id_type' => null, 'id_side' => null];
        }

        $conditionItems = [];
        $raw = $request->input('condition_items');
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            abort_unless(is_array($decoded) && count($decoded) <= 200 && collect($decoded)->every(fn ($id) => is_string($id) && Str::isUuid($id)), 422, 'Invalid condition checklist.');
            $conditionItems = array_values(array_unique($decoded));
        }
        // A used id means the grant was already spent, or belongs to someone else's transaction.
        abort_if(DB::table('transactions')->where('id', $transactionId)->exists(), 409, 'Invalid upload. Please try again.');

        $checks = [];
        Trading::run(function () use ($data, $transactionId, $userId, $uploads, $conditionItems, $papersChecklist, $halfway, $meetupAddress, &$checks) {
            $vehicleId = (string) Str::uuid();
            DB::table('vehicles')->insert([
                'id' => $vehicleId, 'stock_code' => 'SELL-'.strtoupper(substr($data['make'], 0, 3)).'-'.strtoupper(base_convert((string) now()->getTimestampMs(), 10, 36)),
                'make' => trim($data['make']), 'model' => trim($data['model']), 'year' => (int) $data['year'], 'mileage' => (int) $data['mileage'],
                'condition' => $data['condition'], 'description' => $data['description'] ?? null, 'listing_state' => 'draft',
                'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('transactions')->insert([
                'id' => $transactionId, 'customer_id' => $userId, 'transaction_kind' => 'sell', 'vehicle_id' => $vehicleId, 'current_state' => 'pending',
                'created_by' => $userId, 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('sell_details')->insert([
                'id' => (string) Str::uuid(), 'transaction_id' => $transactionId, 'offered_amount' => $data['offered_amount'],
                'condition_items' => json_encode($conditionItems), 'has_known_issues' => $data['has_known_issues'] === 'yes',
                'declared_issues' => $data['has_known_issues'] === 'yes' ? trim((string) $data['declared_issues']) : null,
                'meetup_method' => $data['meetup_method'], 'meetup_lat' => $halfway ? $data['meetup_lat'] : null, 'meetup_lng' => $halfway ? $data['meetup_lng'] : null,
                'meetup_address' => $meetupAddress !== '' ? $meetupAddress : null,
                // SN-13: the OR/CR/Deed answers, so staff and the seller read the same checklist.
                'papers_checklist' => json_encode($papersChecklist),
                'owner_number' => (int) $data['owner_number'], 'created_at' => now(), 'updated_at' => now(),
            ]);
            foreach ($uploads as $upload) {
                $id = (string) Str::uuid();
                // T03 C11 / T10: advisory check of each ID's front; the Marketing Specialist still verifies. SN-11:
                // the OR and the CR are no longer uploaded for a new offer, so there is no "orcr" job to dispatch.
                $check = $upload['kind'] === 'valid_id' && $upload['id_side'] === 'front' ? 'valid_id' : null;
                DB::table('transaction_documents')->insert([
                    'id' => $id, 'transaction_id' => $transactionId, 'document_kind' => $upload['kind'], 'id_type' => $upload['id_type'],
                    'id_side' => $upload['id_side'], 'storage_path' => $upload['path'], 'uploader_id' => $userId,
                    // Photos are attachments and land verified; the papers wait for the Marketing Specialist.
                    'verification_state' => in_array($upload['kind'], self::ATTACHMENTS, true) ? 'verified' : 'pending',
                    'auto_check_status' => $check ? 'pending' : null, 'upload_date' => now(),
                ]);
                if ($check) {
                    CheckTransactionDocument::dispatch($id, $check, $upload['id_type'])->afterCommit();
                }
            }
            DB::table('inquiries')->insert([
                'id' => (string) Str::uuid(), 'customer_id' => $userId, 'vehicle_id' => $vehicleId, 'intention_kind' => 'sell_negotiation',
                'transaction_id' => $transactionId, 'created_at' => now(), 'updated_at' => now(),
            ]);
            Trading::history($transactionId, 'pending', 'pending', $userId, 'Sell transaction created');
        });

        return response()->json(['success' => true, 'id' => $transactionId]);
    }
}
