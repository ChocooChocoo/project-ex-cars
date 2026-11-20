<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * SN-3: once GCE has paid the seller, the Marketing Specialist photographs the physical OR, CR and the previous
 * owner's Deed of Sale and sends them to the Confidential Informant, who keeps the originals until a buyer's sale.
 * The photos are verified transaction documents on the sell transaction; `vehicle_document_items` is the custody
 * record per paper (see the 2026_11_20_000008 migration).
 */
class SellPapersController extends Controller
{
    /** The three originals, by the document kind the photo is stored as. */
    public const PAPERS = [
        'official_receipt' => 'Official Receipt (OR)',
        'certificate_of_registration' => 'Certificate of Registration (CR)',
        'deed_of_sale' => "Deed of Sale (previous owner's)",
    ];

    private const MAX_EXTRA = 4;

    public function capture(Request $request, FileService $files): JsonResponse
    {
        abort_unless($request->user()->hasRole('marketing_specialist', 'ceo'), 403, 'Only the Marketing Specialist captures the vehicle papers.');
        $id = $request->input('transaction_id');
        abort_unless(is_string($id) && Str::isUuid($id), 404, 'Sell offer not found.');
        foreach (array_keys(self::PAPERS) as $kind) {
            abort_unless($request->file($kind), 422, 'Take a photo of the OR, the CR and the Deed of Sale.');
        }
        $extra = $request->file('extra') ?? [];
        $extra = is_array($extra) ? array_values(array_filter($extra)) : [$extra];
        abort_if(count($extra) > self::MAX_EXTRA, 422, 'Add at most '.self::MAX_EXTRA.' extra pages.');

        $actorId = $request->user()->id;
        $stored = [];
        try {
            Trading::run(function () use ($request, $files, $id, $extra, $actorId, &$stored) {
                $tx = Trading::lockTx($id);
                abort_unless($tx && $tx->transaction_kind === 'sell' && $tx->vehicle_id, 404, 'Sell offer not found.');
                abort_unless($tx->current_state === 'completed', 422, 'Capture the papers after GCE has paid the seller.');
                abort_if(DB::table('vehicle_document_items')->where('vehicle_id', $tx->vehicle_id)->whereNotNull('custody_state')->exists(), 409,
                    'The papers of this car were already sent to the Confidential Informant.');

                $now = now();
                $put = function ($file, string $kind, ?string $note) use ($files, $tx, $actorId, $now, &$stored): string {
                    $path = $files->store($file, 'transaction-documents', $tx->id, $kind)['path'];
                    $stored[] = $path;
                    DB::table('transaction_documents')->insert([
                        'id' => (string) Str::uuid(), 'transaction_id' => $tx->id, 'document_kind' => $kind, 'storage_path' => $path,
                        'uploader_id' => $actorId, 'verification_state' => 'verified', 'verifier_id' => $actorId, 'note' => $note, 'upload_date' => $now,
                    ]);

                    return $path;
                };
                foreach (self::PAPERS as $kind => $label) {
                    $path = $put($request->file($kind), $kind, 'Original captured by the Marketing Specialist');
                    DB::table('vehicle_document_items')->updateOrInsert(['vehicle_id' => $tx->vehicle_id, 'document_kind' => $kind], [
                        'required_state' => true, 'submitted_state' => 'verified', 'storage_path' => $path, 'checker_id' => $actorId, 'checked_at' => $now,
                        'source_transaction_id' => $tx->id, 'custody_state' => 'with_ci', 'received_at' => $now,
                    ]);
                }
                foreach ($extra as $i => $file) {
                    $put($file, 'sale_document', 'Extra page '.($i + 1).' of the vehicle papers');
                }
                Trading::history($tx->id, $tx->current_state, $tx->current_state, $actorId, 'Vehicle papers sent to the Confidential Informant');
                Trading::notify(['role' => 'confidential_informant'], 'vehicle_papers_received', 'Vehicle papers to keep',
                    'The Marketing Specialist sent the OR, CR and Deed of Sale of a bought car. Keep the originals; the photos are in Vehicle Papers.', $tx->id);
            });
        } catch (\Throwable $e) {
            foreach ($stored as $path) {
                $files->delete('transaction-documents', $path);
            }
            throw $e;
        }

        return response()->json(['success' => true]);
    }
}
