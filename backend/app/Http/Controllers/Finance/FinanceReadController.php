<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Models\VehicleInspection;
use App\Services\FileService;
use App\Services\Finance\Ledger;
use App\Services\Finance\Money;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Finance and Sold Inventory page reads (was src/app/(staff)/finance/page.tsx and financing/page.tsx). Same row
 * rules as the old RLS: the ledger for CEO/HA/AM, disbursements for CEO/HA/AM (a Confidential Informant sees only
 * their own requests), sale records, field expenses and reconditioning funds for CEO/HA.
 */
class FinanceReadController extends Controller
{
    private static function vehicle(?object $row, string $prefix = 'v_'): ?array
    {
        return $row && $row->{$prefix.'make'} !== null
            ? ['make' => $row->{$prefix.'make'}, 'model' => $row->{$prefix.'model'}, 'year' => (int) $row->{$prefix.'year'}]
            : null;
    }

    public function finance(Request $request, FileService $files): JsonResponse
    {
        $user = $request->user();
        $role = $user->role()->value;
        $books = in_array($role, ['ceo', 'head_accountant'], true);

        $entries = in_array($role, ['ceo', 'head_accountant', 'account_manager'], true)
            ? DB::table('financial_entries')->orderByDesc('recorded_at')->limit(1000)->get()->map(fn ($e) => [
                'id' => $e->id, 'entry_kind' => $e->entry_kind, 'amount_cents' => (int) $e->amount_cents, 'description' => $e->description,
                'verified_by' => $e->verified_by, 'recorded_at' => ApiRow::iso($e->recorded_at), 'transaction_id' => $e->transaction_id,
                // SN-10: the Movement list links each automatic entry back to the car or the field case.
                'field_case_id' => $e->field_case_id,
            ])
            : [];
        $requests = DB::table('disbursement_requests')
            ->when($role === 'confidential_informant', fn ($q) => $q->where('requested_by', $user->id))
            ->orderByDesc('created_at')->limit(1000)->get();
        $contexts = self::fundContexts($requests, $user);
        $disbursements = $requests->map(fn ($d) => [
            'id' => $d->id, 'title' => $d->title, 'amount_cents' => (int) $d->amount_cents, 'purpose' => $d->purpose, 'status' => $d->status,
            'notes' => $d->notes, 'requested_by' => $d->requested_by, 'purchase_transaction_id' => $d->purchase_transaction_id,
            'created_at' => ApiRow::iso($d->created_at), 'field_case_id' => $d->field_case_id,
            'returned_cents' => $d->returned_cents === null ? null : (int) $d->returned_cents, 'returned_at' => ApiRow::iso($d->returned_at),
            'return_confirmed_at' => ApiRow::iso($d->return_confirmed_at),
            // BH-4: the requester reads why the request was refused.
            'rejection_reason' => $d->rejection_reason,
            'context' => $contexts[$d->id] ?? null,
        ]);
        $purchases = DB::table('transactions')->where('transaction_kind', 'buy')->whereNotIn('current_state', ['cancelled', 'rejected'])
            ->orderByDesc('created_at')->limit(50)->get(['id', 'customer_id', 'transaction_kind']);
        // Selling step 10: seller cars cleared by the inspection or the seller's answer, awaiting payment.
        $clearedSells = DB::table('transactions as t')->join('sell_details as s', 's.transaction_id', '=', 't.id')
            ->where('t.transaction_kind', 'sell')->where('t.current_state', 'approved')->whereNotNull('s.cleared_for_payment_at')
            ->get(['t.id', 't.customer_id', 't.transaction_kind']);
        $reconditioningFunds = $books ? self::reconditioningFunds($files) : [];

        return response()->json([
            'role' => $role,
            'entries' => $entries,
            // SN-10: the opening balance the Head Accountant set plus every posted movement. Same audience as the
            // ledger rows themselves: a Confidential Informant reads their own requests, never the company's cash.
            'cashOnHand' => in_array($role, ['ceo', 'head_accountant', 'account_manager'], true) ? self::cashOnHand($entries) : null,
            'disbursements' => $disbursements,
            'purchaseTransactions' => $clearedSells->concat($purchases)->values(),
            'saleRecords' => $books ? self::saleRecords() : [],
            'fieldExpenses' => $books ? self::fieldExpenses() : [],
            'reconditioningFunds' => $reconditioningFunds,
        ]);
    }

    /** SN-10: opening balance and the movement total, in centavos, as the Finance page shows them. */
    private static function cashOnHand(iterable $entries): array
    {
        $net = 0;
        foreach ($entries as $entry) {
            $net += Ledger::effect($entry['entry_kind'], $entry['amount_cents']);
        }
        $opening = Ledger::openingCents();

        return ['opening_cents' => $opening, 'movements_cents' => $net, 'total_cents' => $opening + $net];
    }

    /**
     * SN-9 / BH-4: the deciding context of every fund request — the car, the deal, the parties, the prices and what
     * has been paid so far — so the Head Accountant reads one row instead of opening three pages. Read in bulk: one
     * query per table for the whole page, never one per request.
     *
     * SH-3: a purchase or reconditioning fund also carries the seller meet-up inspection result, serialised by
     * VehicleInspection::pack() like the field page and the vehicle page. Only the roles that review fund requests
     * get it (InspectionController::canReadFundResult); the /inspections page keeps its own narrower role list.
     *
     * @param  Collection<int, object>  $requests
     * @return array<string, array>
     */
    private static function fundContexts(Collection $requests, ?object $user): array
    {
        if ($requests->isEmpty()) {
            return [];
        }
        $caseIds = $requests->pluck('field_case_id')->filter()->unique()->values();
        $cases = $caseIds->isEmpty() ? collect() : DB::table('field_cases')->whereIn('id', $caseIds)->get(['id', 'case_kind', 'transaction_id']);
        // SH-3: a reconditioning fund has no transaction of its own; its car is the repossessed vehicle's, and the
        // inspection is the seller meet-up that brought that car in.
        $reconditioning = DB::table('reconditioning_fund_requests as f')->join('reconditioning_jobs as j', 'j.id', '=', 'f.job_id')
            ->whereIn('f.disbursement_id', $requests->pluck('id'))
            ->get(['f.disbursement_id', 'j.vehicle_id'])->keyBy('disbursement_id');
        $sellTransactions = $reconditioning->isEmpty() ? collect() : DB::table('transactions')
            ->whereIn('vehicle_id', $reconditioning->pluck('vehicle_id')->filter()->unique())->where('transaction_kind', 'sell')
            ->orderBy('opened_at')->get(['id', 'vehicle_id'])->keyBy('vehicle_id');
        $transactionIds = $requests->pluck('purchase_transaction_id')->filter()
            ->concat($cases->pluck('transaction_id')->filter())
            ->concat($reconditioning->map(fn ($r) => $sellTransactions->get($r->vehicle_id)?->id)->filter())
            ->unique()->values();
        if ($transactionIds->isEmpty()) {
            return array_fill_keys($requests->pluck('id')->all(), null);
        }

        $transactions = DB::table('transactions')->whereIn('id', $transactionIds)->get(['id', 'transaction_kind', 'current_state', 'vehicle_id', 'customer_id']);
        $vehicles = DB::table('vehicles')->whereIn('id', $transactions->pluck('vehicle_id')->filter()->unique())
            ->get(['id', 'stock_code', 'year', 'make', 'model', 'condition', 'listing_state'])->keyBy('id');
        $people = DB::table('profiles')->whereIn('id', $transactions->pluck('customer_id')->filter()->unique())
            ->get(['id', 'full_name'])->keyBy('id');
        $sells = DB::table('sell_details')->whereIn('transaction_id', $transactionIds)
            ->get(['transaction_id', 'agreed_price', 'meetup_method', 'has_known_issues', 'declared_issues'])->keyBy('transaction_id');
        $purchases = DB::table('purchase_details')->whereIn('transaction_id', $transactionIds)
            ->get(['transaction_id', 'final_price', 'payment_method', 'payment_option', 'arrangement_kind', 'downpayment_amount', 'delivery_fee'])->keyBy('transaction_id');
        $payments = DB::table('payment_records')->whereIn('transaction_id', $transactionIds)
            ->get(['transaction_id', 'payment_kind', 'amount', 'verified_by', 'rejected_at'])->groupBy('transaction_id');
        $inspections = self::inspections($transactionIds, $user);

        $byTransaction = $transactions->keyBy('id');
        $caseTransaction = $cases->pluck('transaction_id', 'id');
        $out = [];
        foreach ($requests as $request) {
            $txId = $request->purchase_transaction_id
                ?: ($request->field_case_id ? $caseTransaction->get($request->field_case_id) : null)
                ?: ($reconditioning->get($request->id) ? $sellTransactions->get($reconditioning->get($request->id)->vehicle_id)?->id : null);
            $tx = $txId ? $byTransaction->get($txId) : null;
            if (! $tx) {
                $out[$request->id] = null;
                continue;
            }
            $sell = $sells->get($tx->id);
            $buy = $purchases->get($tx->id);
            $vehicle = $tx->vehicle_id ? $vehicles->get($tx->vehicle_id) : null;
            $paid = $payments->get($tx->id) ?? collect();
            $sellSide = $tx->transaction_kind === 'sell';
            $out[$request->id] = [
                'transaction' => [
                    'id' => $tx->id, 'kind' => $tx->transaction_kind, 'state' => $tx->current_state,
                    'arrangement' => $sellSide ? ($sell?->meetup_method ?? 'gce_visit') : $buy?->arrangement_kind,
                ],
                'vehicle' => $vehicle ? ['stock_code' => $vehicle->stock_code, 'year' => (int) $vehicle->year,
                    'make' => $vehicle->make, 'model' => $vehicle->model, 'condition' => $vehicle->condition,
                    'listing_state' => $vehicle->listing_state] : null,
                // The seller of a sell offer is the customer who submitted it; the buyer of a buy is its customer.
                'party' => ['role' => $sellSide ? 'seller' : 'buyer', 'name' => $people->get($tx->customer_id)?->full_name],
                'prices' => [
                    'agreed_cents' => $sellSide ? self::centsOrNull($sell?->agreed_price) : null,
                    'final_cents' => self::centsOrNull($buy?->final_price),
                    'requested_cents' => (int) $request->amount_cents,
                ],
                'payment' => [
                    'option' => $buy?->payment_option,
                    'method' => $buy?->payment_method,
                    'received_cents' => self::verifiedCents($paid),
                    'downpayment' => self::charge($sellSide, $buy?->downpayment_amount, 'downpayment', $paid),
                    'delivery_fee' => self::charge($sellSide || $buy?->arrangement_kind !== 'delivery', $buy?->delivery_fee, 'delivery_fee', $paid),
                ],
                // The sell side's declared condition and issues are what makes a purchase price defensible.
                'issues' => $sellSide ? [
                    'condition' => $vehicle?->condition,
                    'has_known_issues' => $sell?->has_known_issues === null ? null : (bool) $sell->has_known_issues,
                    'declared_issues' => $sell?->declared_issues,
                ] : null,
                'inspection' => $inspections[$tx->id] ?? null,
            ];
        }

        return $out;
    }

    /**
     * SH-3: the seller meet-up inspection result per transaction, packed by the one serialiser the Phase 5 pages
     * use. Gated on the fund-review roles so a fund request never widens the inspection page's audience.
     *
     * @param  Collection<int, string>  $transactionIds
     * @return array<string, array>
     */
    private static function inspections(Collection $transactionIds, ?object $user): array
    {
        if (! \App\Http\Controllers\Catalogue\InspectionController::canReadFundResult($user) || $transactionIds->isEmpty()) {
            return [];
        }
        $cases = DB::table('field_cases')->whereIn('transaction_id', $transactionIds)->where('case_kind', 'acquisition')
            ->orderBy('created_at')->get(['id', 'transaction_id'])->groupBy('transaction_id');
        $out = [];
        foreach ($cases as $txId => $rows) {
            $packed = VehicleInspection::pack($rows->last()->id, (string) $txId);
            if ($packed) {
                $out[$txId] = $packed;
            }
        }

        return $out;
    }

    /** A required-or-not charge and whether its money is confirmed. */
    private static function charge(bool $notRequired, mixed $amount, string $kind, Collection $payments): array
    {
        $cents = Money::cents($amount);
        if ($notRequired || $cents <= 0) {
            return ['amount_cents' => null, 'status' => 'not_required'];
        }
        $paid = self::verifiedCents($payments->filter(fn ($p) => $p->payment_kind === $kind));

        return ['amount_cents' => $cents, 'status' => $paid >= $cents ? 'paid' : 'pending'];
    }

    private static function verifiedCents(iterable $payments): int
    {
        $total = 0;
        foreach ($payments as $payment) {
            if ($payment->verified_by && ! $payment->rejected_at) {
                $total += Money::cents($payment->amount);
            }
        }

        return $total;
    }

    private static function centsOrNull(mixed $amount): ?int
    {
        return $amount === null ? null : Money::cents($amount);
    }

    /** §2 step 7: completed sales for the Head Accountant's records. */
    private static function saleRecords(): array
    {
        $sales = DB::table('transactions as t')->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')->leftJoin('profiles as p', 'p.id', '=', 't.customer_id')
            ->leftJoin('purchase_details as d', 'd.transaction_id', '=', 't.id')
            ->where('t.transaction_kind', 'buy')->where('t.current_state', 'completed')->orderByDesc('t.completed_at')->limit(1000)
            ->get(['t.id', 't.completed_at', 'v.make as v_make', 'v.model as v_model', 'v.year as v_year', 'v.stock_code', 'p.full_name', 'd.final_price', 'd.payment_method']);
        $payments = DB::table('payment_records')->whereIn('transaction_id', $sales->pluck('id'))->get(['transaction_id', 'amount', 'payment_kind', 'rejected_at'])->groupBy('transaction_id');

        return $sales->map(fn ($s) => [
            'id' => $s->id, 'completed_at' => ApiRow::iso($s->completed_at),
            'vehicles' => self::vehicle($s) ? self::vehicle($s) + ['stock_code' => $s->stock_code] : null,
            'profiles' => ['full_name' => $s->full_name],
            'purchase_details' => $s->payment_method === null ? null : ['final_price' => $s->final_price === null ? null : (float) $s->final_price, 'payment_method' => $s->payment_method],
            'payment_records' => ($payments[$s->id] ?? collect())->map(fn ($p) => ['amount' => (float) $p->amount, 'payment_kind' => $p->payment_kind, 'rejected_at' => ApiRow::iso($p->rejected_at)])->values(),
        ])->all();
    }

    /** Selling step 13: unreimbursed field expenses, oldest first. */
    private static function fieldExpenses(): array
    {
        return DB::table('field_case_expenses as e')->leftJoin('field_cases as c', 'c.id', '=', 'e.field_case_id')->leftJoin('vehicles as v', 'v.id', '=', 'c.vehicle_id')
            ->whereNull('e.reimbursed_at')->orderBy('e.submitted_at')
            ->get(['e.id', 'e.amount', 'e.description', 'e.submitted_at', 'e.reimbursed_at', 'e.field_case_id', 'c.transaction_id', 'v.make as v_make', 'v.model as v_model', 'v.year as v_year', 'v.listing_state'])
            ->map(fn ($e) => [
                'id' => $e->id, 'amount' => (float) $e->amount, 'description' => $e->description, 'submitted_at' => ApiRow::iso($e->submitted_at), 'reimbursed_at' => null,
                'field_cases' => $e->field_case_id === null ? null : ['transaction_id' => $e->transaction_id,
                    'vehicles' => self::vehicle($e) ? self::vehicle($e) + ['listing_state' => $e->listing_state] : null],
            ])->all();
    }

    /**
     * A reconditioning fund's own disbursement row in `disbursements` carries its car and inspection context, so
     * these rows only add the job, the receipts and the linked request's status.
     */
    private static function reconditioningFunds(FileService $files): array
    {
        $requests = DB::table('reconditioning_fund_requests as f')->leftJoin('disbursement_requests as d', 'd.id', '=', 'f.disbursement_id')
            ->leftJoin('reconditioning_jobs as j', 'j.id', '=', 'f.job_id')->leftJoin('vehicles as v', 'v.id', '=', 'j.vehicle_id')
            ->orderByDesc('f.created_at')->limit(200)
            ->get(['f.id', 'f.amount_cents', 'f.reason', 'f.shortfall_reason', 'f.created_at', 'd.status as d_status', 'f.disbursement_id', 'j.id as job_id', 'j.vehicle_id',
                'j.state as job_state', 'j.refund_due_cents', 'j.refunded_at', 'v.make as v_make', 'v.model as v_model', 'v.year as v_year']);
        $receipts = DB::table('reconditioning_fund_receipts')->whereIn('fund_request_id', $requests->pluck('id'))->get(['fund_request_id', 'storage_path'])->groupBy('fund_request_id');

        return $requests->map(fn ($r) => [
            'id' => $r->id, 'amount_cents' => (int) $r->amount_cents, 'reason' => $r->reason, 'shortfall_reason' => $r->shortfall_reason, 'created_at' => ApiRow::iso($r->created_at),
            'disbursement_requests' => $r->disbursement_id ? ['status' => $r->d_status] : null,
            'reconditioning_jobs' => $r->job_id ? ['id' => $r->job_id, 'vehicle_id' => $r->vehicle_id, 'state' => $r->job_state,
                'refund_due_cents' => $r->refund_due_cents === null ? null : (int) $r->refund_due_cents, 'refunded_at' => ApiRow::iso($r->refunded_at),
                'vehicles' => self::vehicle($r)] : null,
            'reconditioning_fund_receipts' => ($receipts[$r->id] ?? collect())->map(fn ($x) => ['storage_path' => $x->storage_path,
                'signed_url' => $files->signedUrl('reconditioning-receipts', $x->storage_path)])->values(),
        ])->all();
    }

    /** Sold Inventory (CEO/HA): active financing accounts with their installments, recovery cases and outright sales. */
    public function financing(Request $request): JsonResponse
    {
        $accounts = DB::table('installment_accounts as a')->leftJoin('transactions as t', 't.id', '=', 'a.purchase_transaction_id')
            ->leftJoin('profiles as p', 'p.id', '=', 't.customer_id')->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')
            ->where('a.state', 'active')->get(['a.*', 't.id as t_id', 'p.full_name', 'v.make as v_make', 'v.model as v_model', 'v.year as v_year']);
        $installments = DB::table('installments')->whereIn('account_id', $accounts->pluck('id'))->orderBy('due_date')->get()->groupBy('account_id');
        $cash = DB::table('transactions as t')->join('purchase_details as d', 'd.transaction_id', '=', 't.id')->leftJoin('profiles as p', 'p.id', '=', 't.customer_id')
            ->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')->where('t.transaction_kind', 'buy')->where('t.current_state', 'completed')
            ->whereIn('d.payment_method', ['cash', 'bank_transfer'])->orderByDesc('t.completed_at')
            ->get(['t.id', 't.completed_at', 'p.full_name', 'v.make as v_make', 'v.model as v_model', 'v.year as v_year', 'd.payment_method', 'd.final_price']);

        return response()->json([
            'canRequest' => $request->user()->hasRole('head_accountant'),
            'accounts' => $accounts->map(function ($a) use ($installments) {
                $row = (array) $a;
                unset($row['t_id'], $row['full_name'], $row['v_make'], $row['v_model'], $row['v_year']);
                foreach (['flagged_at', 'created_at', 'updated_at', 'opened_at', 'closed_at'] as $ts) {
                    if (array_key_exists($ts, $row)) {
                        $row[$ts] = ApiRow::iso($row[$ts]);
                    }
                }

                return $row + [
                    'transactions' => $a->t_id ? ['profiles' => ['full_name' => $a->full_name], 'vehicles' => self::vehicle($a)] : null,
                    'installments' => ($installments[$a->id] ?? collect())->map(fn ($i) => (array) $i)->values(),
                ];
            }),
            'cashSales' => $cash->map(fn ($s) => ['id' => $s->id, 'completed_at' => ApiRow::iso($s->completed_at), 'profiles' => ['full_name' => $s->full_name],
                'vehicles' => self::vehicle($s), 'purchase_details' => ['payment_method' => $s->payment_method, 'final_price' => $s->final_price === null ? null : (float) $s->final_price]]),
            'workers' => Trading::fieldWorkers(),
            'cases' => DB::table('field_cases')->where('case_kind', 'recovery')->whereIn('state', ['assigned', 'accepted', 'in_progress'])->get(['id', 'transaction_id']),
        ]);
    }
}
