<?php

namespace App\Http\Controllers\Staff;

use App\Http\Controllers\Controller;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Staff dashboard (was src/app/(staff)/dashboard/page.tsx, dashboard-data.ts, phase6-overview.tsx and
 * reconditioning-overview.tsx). Returns the raw inputs; the browser keeps summarizeDashboard(). Opening the page
 * changes nothing: the due-installment and overdue-review notices it used to send now run on the scheduler.
 */
class DashboardController extends Controller
{
    /** Same list as the "Staff can read financial entries" policy (00016): only they see money received. */
    private const REVENUE_ROLES = ['ceo', 'head_accountant', 'account_manager', 'sales_manager'];

    /** Roles that read inspections (Phase 4 InspectionController routes). */
    private const INSPECTION_READERS = ['ceo', 'account_manager', 'confidential_informant', 'mechanic', 'sales_manager'];

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $role = $user->role()->value;

        return response()->json([
            'role' => $role,
            'transactions' => DB::table('transactions')->get(['customer_id', 'opened_at', 'completed_at', 'current_state'])->map(fn ($t) => [
                'customer_id' => $t->customer_id, 'opened_at' => ApiRow::iso($t->opened_at), 'completed_at' => ApiRow::iso($t->completed_at), 'current_state' => $t->current_state,
            ]),
            // Money received = customer payments the Head Accountant verified (or PayMongo confirmed).
            'revenue' => in_array($role, self::REVENUE_ROLES, true)
                ? DB::table('payment_records')->whereNotNull('verified_by')->get(['amount', 'paid_at', 'settlement_date', 'created_at'])
                    ->map(fn ($r) => ['amount' => (float) $r->amount, 'date' => ApiRow::iso($r->paid_at) ?? ($r->settlement_date ? (string) $r->settlement_date : ApiRow::iso($r->created_at))])
                : null,
            'availableVehicles' => DB::table('vehicles')->where('listing_state', 'available')->count(),
            'operations' => $role === 'ceo' ? self::operations() : null,
            'reconditioning' => in_array($role, self::INSPECTION_READERS, true) ? self::reconditioning() : [],
        ]);
    }

    /** CEO "Operations Overview" counts. Today is the Manila date (the old card used the UTC date). */
    private static function operations(): array
    {
        $today = CarbonImmutable::now('Asia/Manila')->toDateString();

        return [
            'attendanceToday' => DB::table('attendance_entries')->where('attendance_date', $today)->count(),
            'pendingRequests' => DB::table('employee_requests')->where('status', 'pending')->count(),
            'pendingRuns' => DB::table('payroll_runs')->whereIn('status', ['draft', 'pending_approval', 'approved'])->count(),
            'openCases' => DB::table('field_cases')->where('state', '!=', 'completed')->count(),
            'activeDisbursements' => DB::table('disbursement_requests')->whereIn('status', ['submitted', 'approved', 'released', 'received'])->count(),
            'publishedAnnouncements' => DB::table('announcements')->where('status', 'published')->count(),
            'availableInventory' => DB::table('vehicles')->where('listing_state', 'available')->count(),
            'pendingApprovals' => DB::table('reports')->where('status', 'submitted')->count(),
            'soldVehicles' => DB::table('transactions')->where('current_state', 'completed')->count(),
            'verifiedRevenueCents' => (int) DB::table('financial_entries')->where('entry_kind', 'revenue')->whereNotNull('verified_by')->sum('amount_cents'),
        ];
    }

    /** Cars with inspection items flagged for repair or replacement, most flagged first. */
    private static function reconditioning(): array
    {
        $rows = DB::table('inspection_checklist_results as r')->join('vehicle_inspections as i', 'i.id', '=', 'r.inspection_id')
            ->join('vehicles as v', 'v.id', '=', 'i.vehicle_id')->whereIn('r.status', ['for_repair', 'for_replacement'])
            ->whereNotIn('v.listing_state', ['sold', 'archived'])
            ->groupBy('v.id', 'v.make', 'v.model', 'v.year', 'v.listing_state')
            ->selectRaw("v.id, v.make, v.model, v.year, v.listing_state, SUM(r.status = 'for_repair') AS repair_count, SUM(r.status = 'for_replacement') AS replacement_count")
            ->get();

        return $rows->map(fn ($v) => ['id' => $v->id, 'make' => $v->make, 'model' => $v->model, 'year' => (int) $v->year, 'listing_state' => $v->listing_state,
            'repair_count' => (int) $v->repair_count, 'replacement_count' => (int) $v->replacement_count])
            ->sortByDesc(fn ($v) => $v['repair_count'] + $v['replacement_count'])->values()->all();
    }

    /**
     * Recommendations & Insights page (CEO, AM, SM): the raw rows its six cards aggregate in the browser (was six
     * Server Actions reading vehicles, favourites, inquiries, transactions and purchase_details).
     */
    public function insights(): JsonResponse
    {
        return response()->json([
            'vehicles' => DB::table('vehicles')->get(['id', 'listing_state', 'current_price', 'posted_at', 'make', 'model', 'body_type'])->map(fn ($v) => [
                'id' => $v->id, 'listing_state' => $v->listing_state, 'current_price' => $v->current_price === null ? null : (float) $v->current_price,
                'posted_at' => ApiRow::iso($v->posted_at), 'make' => $v->make, 'model' => $v->model, 'body_type' => $v->body_type,
            ]),
            'favourites' => DB::table('favourites')->pluck('vehicle_id')->map(fn ($id) => ['vehicle_id' => $id]),
            'inquiries' => DB::table('inquiries')->get(['vehicle_id', 'created_at'])->map(fn ($i) => ['vehicle_id' => $i->vehicle_id, 'created_at' => ApiRow::iso($i->created_at)]),
            'completedBuys' => DB::table('transactions')->where('transaction_kind', 'buy')->where('current_state', 'completed')->whereNotNull('completed_at')
                ->get(['id', 'completed_at'])->map(fn ($t) => ['id' => $t->id, 'completed_at' => ApiRow::iso($t->completed_at)]),
            'purchases' => DB::table('purchase_details')->get(['transaction_id', 'final_price'])->map(fn ($p) => ['transaction_id' => $p->transaction_id,
                'final_price' => $p->final_price === null ? null : (float) $p->final_price]),
        ]);
    }
}
