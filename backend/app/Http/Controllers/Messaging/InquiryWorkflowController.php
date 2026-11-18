<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Services\Trading\Trading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Inquiry routing and viewing arrangements (was src/app/(customer)/my-inquiries/server-actions.ts). */
class InquiryWorkflowController extends Controller
{
    public function create(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('customer'), 403, 'Not authorized');
        $data = $request->validate(['vehicle_id' => ['required', 'uuid', 'exists:vehicles,id'], 'intention_kind' => ['nullable', 'in:inquiry,buy_now']], ['*' => 'Invalid inquiry.']);
        $id = (string) Str::uuid();
        DB::table('inquiries')->insert([
            'id' => $id, 'customer_id' => $request->user()->id, 'vehicle_id' => $data['vehicle_id'], 'intention_kind' => ($data['intention_kind'] ?? null) ?: 'inquiry',
            'created_at' => now(), 'updated_at' => now(),
        ]);

        return response()->json(['success' => true, 'id' => $id]);
    }

    public function assign(Request $request, string $id): JsonResponse
    {
        $role = $request->input('role');
        abort_unless(in_array($role, ['account_manager', 'sales_manager'], true) && $request->user()->hasRole($role), 403, 'Not authorized');
        $column = $role === 'account_manager' ? 'assigned_account_manager' : 'assigned_sales_manager';
        DB::transaction(function () use ($id, $column, $request) {
            abort_unless(DB::table('inquiries')->where('id', $id)->lockForUpdate()->exists(), 404, 'Inquiry not found.');
            DB::table('inquiries')->where('id', $id)->update([$column => $request->user()->id, 'updated_at' => now()]);
            DB::table('inquiries')->where('id', $id)->where('state', 'open')->update(['state' => 'assigned']);
        });

        return response()->json(['success' => true]);
    }

    /** scheduleArrangement: the location defaults to the customer's profile address, then the staff member's. */
    public function schedule(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasRole('account_manager', 'sales_manager'), 403, 'Not authorized');
        $data = $request->validate([
            'inquiry_id' => ['required', 'uuid'], 'arrangement_kind' => ['required', 'in:delivery,meetup,gce_visit'], 'schedule' => ['required', 'string'],
            'location' => ['nullable', 'string', 'max:500'], 'notes' => ['nullable', 'string', 'max:500'],
        ], ['schedule.required' => 'Schedule is required.', '*' => 'Invalid arrangement.']);
        $schedule = Trading::parseTime($data['schedule']);
        abort_unless($schedule, 422, 'Schedule is required.');
        $location = DB::transaction(function () use ($request, $data, $schedule) {
            $inquiry = DB::table('inquiries')->where('id', $data['inquiry_id'])->lockForUpdate()->first(['customer_id']);
            abort_unless($inquiry, 404, 'Inquiry not found.');
            $location = ($data['location'] ?? null) ?: null;
            $location ??= DB::table('profiles')->where('id', $inquiry->customer_id)->value('address');
            $location ??= DB::table('profiles')->where('id', $request->user()->id)->value('address');
            abort_if(Trading::insertArrangement([
                'inquiry_id' => $data['inquiry_id'], 'arrangement_kind' => $data['arrangement_kind'], 'schedule' => $schedule, 'location' => $location, 'notes' => ($data['notes'] ?? null) ?: null,
            ]) === 'slot_taken', 409, 'That visit slot is already taken. Choose another time.');
            DB::table('inquiries')->where('id', $data['inquiry_id'])->update(['state' => 'scheduled', 'updated_at' => now()]);

            return $location;
        });

        return response()->json(['success' => true, 'location' => $location]);
    }

    public function handoff(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('account_manager'), 403, 'Only the Account Manager can request a handoff.');
        DB::transaction(function () use ($id) {
            $inquiry = DB::table('inquiries')->where('id', $id)->lockForUpdate()->first(['state', 'handoff_state']);
            abort_unless($inquiry, 404, 'Inquiry not found.');
            abort_if($inquiry->state !== 'scheduled', 422, 'A viewing must be scheduled before handing off.');
            abort_if($inquiry->handoff_state === 'pending_handoff', 409, 'A handoff is already pending acceptance.');
            abort_if($inquiry->handoff_state === 'handed_off', 409, 'This inquiry has already been handed off.');
            DB::table('inquiries')->where('id', $id)->update(['handoff_state' => 'pending_handoff', 'updated_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    public function acceptHandoff(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('sales_manager'), 403, 'Only the Sales Manager can accept a handoff.');
        DB::transaction(function () use ($request, $id) {
            $inquiry = DB::table('inquiries')->where('id', $id)->lockForUpdate()->first(['handoff_state']);
            abort_unless($inquiry, 404, 'Inquiry not found.');
            abort_if($inquiry->handoff_state !== 'pending_handoff', 409, 'There is no pending handoff to accept.');
            DB::table('inquiries')->where('id', $id)->update(['handoff_state' => 'handed_off', 'state' => 'handed_off', 'assigned_sales_manager' => $request->user()->id, 'updated_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    public function reviewReport(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->hasRole('ceo', 'account_manager'), 403, 'Not authorized');
        abort_unless(DB::table('message_reports')->where('id', $id)->exists(), 404, 'Report not found.');
        DB::table('message_reports')->where('id', $id)->update([
            'state' => $request->input('decision') === 'dismiss' ? 'dismissed' : 'upheld', 'reviewer_id' => $request->user()->id, 'decision_date' => now(),
        ]);

        return response()->json(['success' => true]);
    }
}
