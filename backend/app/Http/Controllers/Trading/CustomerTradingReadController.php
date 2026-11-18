<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Controller;
use App\Models\CustomerReview;
use App\Models\FieldCase;
use App\Models\InspectionChecklistNode;
use App\Models\Installment;
use App\Models\InstallmentAccount;
use App\Models\PaymentRecord;
use App\Models\PaymentTerm;
use App\Models\PurchaseDetail;
use App\Models\SaleHandover;
use App\Models\SellDetail;
use App\Models\Transaction;
use App\Models\TransactionDocument;
use App\Models\TransactionStatusHistory;
use App\Models\Vehicle;
use App\Models\ViewingArrangement;
use App\Services\FileService;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Customer page data (was the Server Component loaders of my-transactions/page.tsx, my-transactions/[id]/page.tsx
 * and sell-vehicle/page.tsx). Each answer carries the props those pages passed to their components.
 */
class CustomerTradingReadController extends Controller
{
    /** Documents without storage_path, with is_image and a 1-hour signed_url (withSignedTransactionDocumentUrls). */
    public static function signedDocuments(iterable $documents): array
    {
        $files = app(FileService::class);

        return collect($documents)->map(function ($doc) use ($files) {
            $row = ApiRow::of($doc);
            $path = $row['storage_path'] ?? null;
            unset($row['storage_path']);

            return $row + ['is_image' => is_string($path) && preg_match('/\.(?:jpe?g|png|webp)$/i', $path) === 1, 'signed_url' => $files->signedUrl('transaction-documents', $path, 3600)];
        })->values()->all();
    }

    /** GET /my-transactions: rows for TransactionsView plus the customer's reviews. */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $transactions = Transaction::query()->where('customer_id', $userId)->orderByDesc('updated_at')->get();
        $vehicles = Vehicle::query()->whereIn('id', $transactions->pluck('vehicle_id')->filter())->get()->keyBy('id');
        $reviews = CustomerReview::query()->where('customer_id', $userId)->orderByDesc('created_at')->get(['id', 'rating', 'body', 'created_at', 'vehicle_id']);
        $reviewVehicles = Vehicle::query()->whereIn('id', $reviews->pluck('vehicle_id')->filter())->get(['id', 'make', 'model', 'year'])->keyBy('id');

        return response()->json([
            'transactions' => $transactions->map(fn ($t) => ApiRow::of($t) + ['vehicles' => ApiRow::of($vehicles[$t->vehicle_id] ?? null, ['make', 'model', 'year', 'stock_code'])])->values(),
            'reviews' => $reviews->map(fn ($r) => ApiRow::of($r, ['id', 'rating', 'body', 'created_at']) + ['vehicles' => ApiRow::of($reviewVehicles[$r->vehicle_id] ?? null, ['make', 'model', 'year'])])->values(),
        ]);
    }

    /** GET /my-transactions/{id}: every prop of TransactionDetail except the profile autofill (the browser has it). */
    public function show(Request $request, string $id): JsonResponse
    {
        abort_unless(Str::isUuid($id), 404);
        $userId = $request->user()->id;
        $tx = Transaction::query()->where('id', $id)->where('customer_id', $userId)->firstOrFail();
        $vehicle = $tx->vehicle_id ? Vehicle::query()->find($tx->vehicle_id) : null;
        $handover = SaleHandover::query()->find($id);
        $handoverRow = $handover ? ApiRow::of($handover, ['papers_status', 'contract_state', 'contract_body', 'contract_signed_at', 'signing_method']) : null;
        // The buyer reads the contract only once the Head Accountant has approved it.
        if ($handoverRow && ! in_array($handoverRow['contract_state'], ['approved', 'signed'], true)) {
            $handoverRow['contract_body'] = null;
        }
        $transaction = ApiRow::of($tx) + [
            'vehicles' => ApiRow::of($vehicle, ['make', 'model', 'year', 'stock_code', 'current_price', 'financing_markup_pct']),
            'purchase_details' => ApiRow::of(PurchaseDetail::query()->where('transaction_id', $id)->first()),
            'sell_details' => ApiRow::of(SellDetail::query()->where('transaction_id', $id)->first()),
            'sale_handovers' => $handoverRow,
        ];
        $account = InstallmentAccount::query()->where('purchase_transaction_id', $id)->first();
        $buy = $tx->transaction_kind === 'buy';
        $cases = $buy ? FieldCase::query()->where('transaction_id', $id)->whereIn('case_kind', ['delivery', 'recovery'])->where('state', '!=', 'cancelled')
            ->orderByDesc('created_at')->get() : collect();
        $delivery = $cases->firstWhere('case_kind', 'delivery');
        $recovery = $cases->firstWhere('case_kind', 'recovery');
        $location = fn ($c) => ['last_lat' => $c->last_lat, 'last_lng' => $c->last_lng, 'last_located_at' => $c->last_located_at?->toJSON()];

        // §2 step 3: times already locked by other buyers for this car (list_taken_visit_slots; no buyer details).
        $taken = $buy && $tx->vehicle_id ? ViewingArrangement::query()->where('vehicle_id', $tx->vehicle_id)->where('arrangement_kind', 'gce_visit')
            ->whereIn('confirmation_state', ['pending', 'confirmed'])->where('schedule', '>', now())->orderBy('schedule')->get(['schedule'])
            ->map(fn ($a) => $a->schedule->toJSON())->values() : [];

        $counter = null;
        if ($tx->transaction_kind === 'sell') {
            $report = DB::table('inspection_issue_reports as r')->leftJoin('vehicle_price_proposals as p', 'p.id', '=', 'r.proposal_id')
                ->where('r.transaction_id', $id)->where('r.is_profitable', true)
                ->first(['r.recalculated_price', 'r.seller_remarks', 'r.issue_found', 'r.seller_response', 'p.decision']);
            if ($report && $report->decision === 'approved' && $report->recalculated_price !== null) {
                $counter = ['price' => (float) $report->recalculated_price, 'remarks' => $report->seller_remarks, 'issue' => $report->issue_found, 'response' => $report->seller_response];
            }
        }
        $own = $vehicle?->financing_markup_pct;

        return response()->json([
            'transaction' => $transaction,
            'history' => ApiRow::list(TransactionStatusHistory::query()->where('transaction_id', $id)->orderBy('changed_at')->get()),
            'documents' => self::signedDocuments(TransactionDocument::query()->where('transaction_id', $id)->orderByDesc('upload_date')->get()),
            'payments' => ApiRow::list(PaymentRecord::query()->where('transaction_id', $id)->orderByDesc('settlement_date')->get()),
            'installmentAccount' => $account ? ApiRow::of($account) + ['installments' => ApiRow::list(Installment::query()->where('account_id', $account->id)->orderBy('sequence_no')->get())] : null,
            'paymentTerms' => ApiRow::of(PaymentTerm::query()->where('purchase_transaction_id', $id)->first()),
            'viewingArrangements' => ApiRow::list(ViewingArrangement::query()->where('purchase_transaction_id', $id)->orderByDesc('created_at')->get()),
            'review' => ApiRow::of(CustomerReview::query()->where('transaction_id', $id)->where('customer_id', $userId)->first(), ['rating', 'body', 'created_at']),
            'negotiationThreadId' => DB::table('inquiries')->where('transaction_id', $id)->value('id'),
            'counterOffer' => $counter,
            'gceVisitOnly' => (bool) DB::table('customer_standing')->where('account_id', $userId)->value('gce_visit_only'),
            'delivery' => $delivery ? ['id' => $delivery->id, 'status' => $delivery->delivery_status, 'delay_note' => $delivery->delay_note, 'expected_arrival' => $delivery->expected_arrival?->toJSON()] + $location($delivery) : null,
            'recovery' => $recovery ? ['id' => $recovery->id, 'state' => $recovery->state] + $location($recovery) : null,
            'takenSlots' => $taken,
            'financingMarkupPct' => $own !== null && (float) $own >= 0 ? (float) $own : ShowroomController::globalMarkupPct(),
            'buyerRegionCode' => DB::table('profiles')->where('id', $userId)->value('region_code'),
        ]);
    }

    /** GET /sell/checklist: the active condition checklist for the sell form. */
    public function checklist(): JsonResponse
    {
        return response()->json(['nodes' => ApiRow::list(InspectionChecklistNode::query()->where('active', true)->orderBy('display_order')->get(['id', 'parent_id', 'level', 'name']))]);
    }
}
