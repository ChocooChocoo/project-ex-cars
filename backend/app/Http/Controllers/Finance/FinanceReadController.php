<?php

namespace App\Http\Controllers\Finance;

use App\Http\Controllers\Controller;
use App\Services\FileService;
use App\Services\Trading\Trading;
use App\Support\ApiRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            ])
            : [];
        $disbursements = DB::table('disbursement_requests')->when($role === 'confidential_informant', fn ($q) => $q->where('requested_by', $user->id))
            ->orderByDesc('created_at')->limit(1000)->get()->map(fn ($d) => [
                'id' => $d->id, 'title' => $d->title, 'amount_cents' => (int) $d->amount_cents, 'purpose' => $d->purpose, 'status' => $d->status,
                'notes' => $d->notes, 'requested_by' => $d->requested_by, 'purchase_transaction_id' => $d->purchase_transaction_id,
                'created_at' => ApiRow::iso($d->created_at), 'field_case_id' => $d->field_case_id,
                'returned_cents' => $d->returned_cents === null ? null : (int) $d->returned_cents, 'returned_at' => ApiRow::iso($d->returned_at),
                'return_confirmed_at' => ApiRow::iso($d->return_confirmed_at),
            ]);
        $purchases = DB::table('transactions')->where('transaction_kind', 'buy')->whereNotIn('current_state', ['cancelled', 'rejected'])
            ->orderByDesc('created_at')->limit(50)->get(['id', 'customer_id', 'transaction_kind']);
        // Selling step 10: seller cars cleared by the inspection or the seller's answer, awaiting payment.
        $clearedSells = DB::table('transactions as t')->join('sell_details as s', 's.transaction_id', '=', 't.id')
            ->where('t.transaction_kind', 'sell')->where('t.current_state', 'approved')->whereNotNull('s.cleared_for_payment_at')
            ->get(['t.id', 't.customer_id', 't.transaction_kind']);

        return response()->json([
            'role' => $role,
            'entries' => $entries,
            'disbursements' => $disbursements,
            'purchaseTransactions' => $clearedSells->concat($purchases)->values(),
            'saleRecords' => $books ? self::saleRecords() : [],
            'fieldExpenses' => $books ? self::fieldExpenses() : [],
            'reconditioningFunds' => $books ? self::reconditioningFunds($files) : [],
        ]);
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
