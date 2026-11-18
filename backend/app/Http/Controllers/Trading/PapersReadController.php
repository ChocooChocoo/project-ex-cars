<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Models\InstallmentAccount;
use App\Models\PaymentTerm;
use App\Models\PurchaseDetail;
use App\Models\Transaction;
use App\Models\TransactionDocument;
use App\Models\Vehicle;
use App\Services\FileService;
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

    /** GET /staff/vehicle-papers: CI and CEO. Each handover with its sale, buyer, car and the car's registration paper. */
    public function index(Request $request, FileService $files): JsonResponse
    {
        $handovers = DB::table('sale_handovers')->whereNotNull('papers_status')->orderBy('papers_updated_at')
            ->get(['transaction_id', 'papers_status', 'papers_updated_at']);
        $txs = Transaction::query()->whereIn('id', $handovers->pluck('transaction_id'))->get(['id', 'customer_id', 'vehicle_id'])->keyBy('id');
        $names = DB::table('profiles')->whereIn('id', $txs->pluck('customer_id'))->pluck('full_name', 'id');
        $vehicles = Vehicle::query()->whereIn('id', $txs->pluck('vehicle_id')->filter())->get(['id', 'make', 'model', 'year', 'stock_code'])->keyBy('id');
        $kinds = DB::table('purchase_details')->whereIn('transaction_id', $txs->keys())->pluck('arrangement_kind', 'transaction_id');

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
            'handovers' => $handovers->map(function ($h) use ($txs, $names, $vehicles, $kinds) {
                $tx = $txs[$h->transaction_id] ?? null;

                return [
                    'transaction_id' => $h->transaction_id, 'papers_status' => $h->papers_status,
                    'papers_updated_at' => $h->papers_updated_at ? CarbonImmutable::parse($h->papers_updated_at, 'UTC')->toJSON() : null,
                    'transactions' => $tx ? [
                        'id' => $tx->id, 'purchase_details' => ['arrangement_kind' => $kinds[$tx->id] ?? null],
                        'profiles' => ['full_name' => $names[$tx->customer_id] ?? null],
                        'vehicles' => ApiRow::of($vehicles[$tx->vehicle_id] ?? null),
                    ] : null,
                ];
            })->values(),
            'orcrByVehicle' => (object) array_filter($orcr),
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

        $profile = DB::table('profiles')->where('id', $tx->customer_id)->first(['full_name', 'address']);
        $source = ApiRow::of($tx, ['id', 'opened_at', 'completed_at']) + [
            'purchase_details' => ApiRow::of(PurchaseDetail::query()->where('transaction_id', $transactionId)->first(), ['final_price']),
            'profiles' => $profile ? (array) $profile : null,
            'vehicles' => ApiRow::of($tx->vehicle_id ? Vehicle::query()->find($tx->vehicle_id) : null,
                ['make', 'model', 'year', 'exterior_color', 'plate_number', 'engine_number', 'chassis_number', 'vin', 'warranty_details']),
        ];
        $result = ['source' => $source];
        if ($paper === 'missed-payment-policy') {
            $result['source']['payment_terms'] = ApiRow::of(PaymentTerm::query()->where('purchase_transaction_id', $transactionId)->first(),
                ['total_amount', 'down_payment', 'duration_months', 'number_of_payments', 'monthly_payment', 'first_due_date']);
            $result['source']['installment_accounts'] = ApiRow::of(InstallmentAccount::query()->where('purchase_transaction_id', $transactionId)->first(), ['opening_balance']);
        }
        if ($paper === 'contract') {
            $handover = DB::table('sale_handovers')->where('transaction_id', $transactionId)
                ->first(['contract_body', 'contract_state', 'contract_signed_at', 'signature_path', 'ci_signature_path']);
            $result += [
                'contractBody' => $handover?->contract_body,
                'signaturePath' => $handover?->signature_path,
                'ciSignaturePath' => $handover?->ci_signature_path,
                'buyerSignatureUrl' => $files->signedUrl('transaction-documents', $handover?->signature_path, 900),
                'ciSignatureUrl' => $files->signedUrl('transaction-documents', $handover?->ci_signature_path, 900),
            ];
        }

        return response()->json($result);
    }
}
