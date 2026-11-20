<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Models\InstallmentAccount;
use App\Models\PaymentTerm;
use App\Models\PurchaseDetail;
use App\Models\Transaction;
use App\Models\Vehicle;
use App\Services\FileService;
use App\Services\Trading\BuyRules;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Vehicle papers (was (staff)/vehicle-papers/page.tsx and the four printable [transactionId] pages). */
class PapersReadController extends Controller
{
    /** Who may open each paper besides the buyer and the CI assigned to the field case (paper-access.ts). */
    private const PAPER_ROLES = [
        'contract' => ['ceo', 'head_accountant', 'sales_manager'],
        'missed-payment-policy' => ['ceo', 'head_accountant', 'sales_manager'],
        'deed-of-sale' => ['confidential_informant', 'ceo', 'head_accountant', 'sales_manager'],
        'policy-warranty' => ['confidential_informant', 'ceo', 'head_accountant', 'sales_manager'],
    ];

    /** BC-7: the seller-origin papers and the seller's ID copies a buyer's sale may open. */
    private const CAR_PAPER_KINDS = ['official_receipt', 'certificate_of_registration', 'deed_of_sale', 'orcr', 'sale_document', 'valid_id'];

    private const SHORT_LINK_SECONDS = 900;

    private static function iso(mixed $at): ?string
    {
        return $at ? CarbonImmutable::parse($at, 'UTC')->toJSON() : null;
    }

    /**
     * GET /staff/vehicle-papers: CI and CEO. SN-4: two lists. "To buyers" is each handover with its sale, buyer, car
     * and the car's registration paper; "From sellers" is the custody record of the originals each seller gave GCE.
     */
    public function index(Request $request, FileService $files): JsonResponse
    {
        $handovers = DB::table('sale_handovers')->whereNotNull('papers_status')->orderBy('papers_updated_at')
            ->get(['transaction_id', 'papers_status', 'papers_updated_at']);
        $txs = Transaction::query()->whereIn('id', $handovers->pluck('transaction_id'))->get(['id', 'customer_id', 'vehicle_id'])->keyBy('id');
        $names = DB::table('profiles')->whereIn('id', $txs->pluck('customer_id'))->pluck('full_name', 'id');
        $vehicles = Vehicle::query()->whereIn('id', $txs->pluck('vehicle_id')->filter())->get(['id', 'make', 'model', 'year', 'stock_code'])->keyBy('id');
        $details = DB::table('purchase_details')->whereIn('transaction_id', $txs->keys())->get(['transaction_id', 'arrangement_kind', 'payment_method'])->keyBy('transaction_id');

        // The OR/CR GCE kept when it bought the car hangs on the car's first sell transaction.
        $orcr = [];
        foreach ($vehicles->keys() as $vehicleId) {
            $sellId = DB::table('transactions')->where('vehicle_id', $vehicleId)->where('transaction_kind', 'sell')->orderBy('opened_at')->value('id');
            $path = $sellId ? DB::table('transaction_documents')->where('transaction_id', $sellId)
                ->whereIn('document_kind', ['orcr', 'official_receipt', 'certificate_of_registration'])->whereNotNull('storage_path')
                ->orderBy('upload_date')->value('storage_path') : null;
            $orcr[$vehicleId] = $files->signedUrl('transaction-documents', $path, 3600);
        }

        return response()->json([
            'role' => $request->user()->role()?->value,
            'handovers' => $handovers->map(function ($h) use ($txs, $names, $vehicles, $details) {
                $tx = $txs[$h->transaction_id] ?? null;
                $d = $tx ? ($details[$tx->id] ?? null) : null;

                return [
                    'transaction_id' => $h->transaction_id, 'papers_status' => $h->papers_status,
                    'papers_updated_at' => self::iso($h->papers_updated_at),
                    'transactions' => $tx ? [
                        'id' => $tx->id, 'purchase_details' => ['arrangement_kind' => $d?->arrangement_kind, 'payment_method' => $d?->payment_method],
                        'profiles' => ['full_name' => $names[$tx->customer_id] ?? null],
                        'vehicles' => ApiRow::of($vehicles[$tx->vehicle_id] ?? null),
                    ] : null,
                ];
            })->values(),
            'orcrByVehicle' => (object) array_filter($orcr),
            'fromSellers' => self::fromSellers($files),
        ]);
    }

    /** SN-4: one row per bought car whose originals the Marketing Specialist sent to the CI. */
    private static function fromSellers(FileService $files): array
    {
        $items = DB::table('vehicle_document_items')->whereNotNull('custody_state')->orderByDesc('received_at')
            ->get(['vehicle_id', 'document_kind', 'storage_path', 'custody_state', 'received_at', 'source_transaction_id'])->groupBy('vehicle_id');
        if ($items->isEmpty()) {
            return [];
        }
        $vehicles = Vehicle::query()->whereIn('id', $items->keys())->get(['id', 'make', 'model', 'year', 'stock_code'])->keyBy('id');
        $sellers = DB::table('transactions as t')->join('profiles as p', 'p.id', '=', 't.customer_id')
            ->whereIn('t.id', $items->flatten()->pluck('source_transaction_id')->filter()->unique())->pluck('p.full_name', 't.id');

        return $items->map(function ($rows, $vehicleId) use ($vehicles, $sellers, $files) {
            $first = $rows->first();
            $car = $vehicles[$vehicleId] ?? null;

            return [
                'vehicle_id' => $vehicleId,
                'vehicle' => $car ? trim("{$car->year} {$car->make} {$car->model}").($car->stock_code ? " ({$car->stock_code})" : '') : 'A bought car',
                'seller' => $sellers[$first->source_transaction_id] ?? null,
                'source_transaction_id' => $first->source_transaction_id,
                'received_at' => self::iso($first->received_at),
                // One custody state per car: the papers travel together.
                'custody_state' => $first->custody_state,
                'papers' => $rows->map(fn ($r) => [
                    'document_kind' => $r->document_kind, 'label' => SellPapersController::PAPERS[$r->document_kind] ?? $r->document_kind,
                    'url' => $files->signedUrl('transaction-documents', $r->storage_path, self::SHORT_LINK_SECONDS),
                ])->sortBy(fn ($p) => array_search($p['document_kind'], array_keys(SellPapersController::PAPERS), true))->values(),
            ];
        })->values()->all();
    }

    /**
     * GET /staff/transactions/{id}/car-papers (BC-7): on a buy transaction, the papers GCE received with the car — the
     * OR, CR, the previous owner's Deed of Sale, extra pages and the seller's ID copies — as short-lived links.
     */
    public function carPapers(FileService $files, string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 404);
        $tx = Transaction::query()->find($id, ['id', 'vehicle_id', 'transaction_kind']);
        abort_unless($tx && $tx->transaction_kind === 'buy' && $tx->vehicle_id, 404, 'Resource not found.');
        $sellId = DB::table('transactions')->where('vehicle_id', $tx->vehicle_id)->where('transaction_kind', 'sell')->orderBy('opened_at')->value('id');
        $docs = $sellId ? DB::table('transaction_documents')->where('transaction_id', $sellId)->whereIn('document_kind', self::CAR_PAPER_KINDS)
            ->whereNotNull('storage_path')->where('verification_state', '!=', 'rejected')->orderBy('upload_date')
            ->get(['id', 'document_kind', 'id_side', 'note', 'storage_path']) : collect();
        $custody = DB::table('vehicle_document_items')->where('vehicle_id', $tx->vehicle_id)->whereNotNull('custody_state')->value('custody_state');

        return response()->json([
            'seller' => $sellId ? DB::table('transactions as t')->join('profiles as p', 'p.id', '=', 't.customer_id')->where('t.id', $sellId)->value('p.full_name') : null,
            'custodyState' => $custody,
            'documents' => $docs->map(fn ($d) => [
                'id' => $d->id, 'document_kind' => $d->document_kind, 'id_side' => $d->id_side, 'note' => $d->note,
                'url' => $files->signedUrl('transaction-documents', $d->storage_path, self::SHORT_LINK_SECONDS),
            ])->values(),
        ]);
    }

    /** GET /papers/{transactionId}/{paper}: the TransactionPaperSource for one printable paper. */
    public function show(Request $request, FileService $files, string $transactionId, string $paper): JsonResponse
    {
        abort_unless(isset(self::PAPER_ROLES[$paper]) && Str::isUuid($transactionId), 404);
        $user = $request->user();
        $tx = Transaction::query()->find($transactionId);
        $staff = $user->hasRole(...self::PAPER_ROLES[$paper]);
        $reader = $tx && ($tx->customer_id === $user->id || DB::table('field_cases')->where('transaction_id', $transactionId)
            ->whereIn('case_kind', ['delivery', 'buyer_meetup'])->where('state', '!=', 'cancelled')->value('assigned_confidential_informant') === $user->id);
        abort_unless($staff || $reader, 403, 'You do not have permission for this action.');
        abort_unless($tx, 404, 'Resource not found.');

        $details = PurchaseDetail::query()->where('transaction_id', $transactionId)->first();
        // BC-6: the Policy & Warranty (with the missed-payment clauses) is a financing paper only.
        abort_if($paper === 'policy-warranty' && $details?->payment_method !== 'financing', 404, 'A Policy & Warranty is issued only for a financing sale.');

        $profile = DB::table('profiles')->where('id', $tx->customer_id)->first(['full_name', 'address']);
        $source = ApiRow::of($tx, ['id', 'opened_at', 'completed_at']) + [
            'purchase_details' => ApiRow::of($details, ['final_price', 'payment_method', 'arrangement_kind']),
            'profiles' => $profile ? (array) $profile : null,
            'vehicles' => ApiRow::of($tx->vehicle_id ? Vehicle::query()->find($tx->vehicle_id) : null,
                ['make', 'model', 'year', 'exterior_color', 'plate_number', 'engine_number', 'chassis_number', 'vin']),
        ];
        $result = ['source' => $source];
        if (in_array($paper, ['missed-payment-policy', 'policy-warranty'], true)) {
            $result['source']['payment_terms'] = ApiRow::of(PaymentTerm::query()->where('purchase_transaction_id', $transactionId)->first(),
                ['total_amount', 'down_payment', 'duration_months', 'number_of_payments', 'monthly_payment', 'first_due_date']);
            $result['source']['installment_accounts'] = ApiRow::of(InstallmentAccount::query()->where('purchase_transaction_id', $transactionId)->first(), ['opening_balance']);
        }
        $handover = DB::table('sale_handovers')->where('transaction_id', $transactionId)->first();
        if ($paper === 'contract') {
            $result += [
                'contractBody' => $handover?->contract_body,
                'signaturePath' => $handover?->signature_path,
                'ciSignaturePath' => $handover?->ci_signature_path,
            ];
        }
        if ($paper !== 'missed-payment-policy') {
            $result['signatures'] = self::signatures($files, $details, $handover);
        }

        return response()->json($result);
    }

    /**
     * BC-2 / BC-3: the images drawn above the printed names. The buyer's own e-signature; for GCE, the Sales
     * Manager's at a GCE visit and the Confidential Informant's in the field. A paper signed face-to-face has none,
     * so its lines stay empty for pen.
     *
     * @return array{buyerUrl: ?string, gceName: ?string, gceRole: string, gceUrl: ?string}
     */
    private static function signatures(FileService $files, ?object $details, ?object $handover): array
    {
        $atOffice = BuyRules::needsSmSignature($details);
        $gcePath = $atOffice ? $handover?->sm_signature_path : $handover?->ci_signature_path;
        $gceSigner = $atOffice ? $handover?->sm_signed_by : $handover?->papers_ci_id;
        if (! $atOffice && ! $gceSigner && $handover?->ci_signature_path) {
            $gceSigner = DB::table('field_cases')->where('transaction_id', $handover->transaction_id)->whereIn('case_kind', ['delivery', 'buyer_meetup'])
                ->where('state', '!=', 'cancelled')->value('assigned_confidential_informant');
        }

        return [
            'buyerUrl' => $files->signedUrl('transaction-documents', $handover?->signature_path, self::SHORT_LINK_SECONDS),
            'gceName' => $gceSigner ? DB::table('profiles')->where('id', $gceSigner)->value('full_name') : null,
            'gceRole' => $atOffice ? 'Sales Manager' : 'Confidential Informant',
            'gceUrl' => $files->signedUrl('transaction-documents', $gcePath, self::SHORT_LINK_SECONDS),
        ];
    }
}
