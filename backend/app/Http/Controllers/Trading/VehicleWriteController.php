<?php

namespace App\Http\Controllers\Trading;

use App\Http\Controllers\Controller;
use App\Services\Trading\SellFlow;
use App\Services\Trading\Trading;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Staff vehicle writes (was src/app/(staff)/vehicles/actions.ts): inventory, price proposals, the CEO's
 * price and ceiling decisions, inspections. Showroom media and content stay in StaffVehicleController.
 */
class VehicleWriteController extends Controller
{
    private function role(Request $request): string
    {
        return (string) $request->user()->role()?->value;
    }

    /** The vehicleSchema columns, normalised like the old action (blank optional text → null). */
    private function vehicleColumns(Request $request): array
    {
        $data = $request->validate([
            'vin' => ['required', 'string', 'max:50'], 'plate_number' => ['required', 'string', 'max:50'], 'engine_number' => ['required', 'string', 'max:50'],
            'chassis_number' => ['required', 'string', 'max:50'], 'make' => ['required', 'string', 'max:100'], 'model' => ['required', 'string', 'max:100'],
            'year' => ['required', 'integer', 'min:1900', 'max:2100'], 'mileage' => ['nullable', 'integer', 'min:0'],
            'fuel_type' => ['nullable', 'string', 'max:50'], 'transmission' => ['nullable', 'string', 'max:50'], 'exterior_color' => ['nullable', 'string', 'max:50'],
            'interior_color' => ['nullable', 'string', 'max:50'], 'interior_features' => ['nullable', 'string', 'max:1000'],
            'body_type' => ['nullable', 'string', 'max:50'], 'purpose' => ['nullable', 'string', 'max:50'],
            'engine' => ['nullable', 'string', 'max:200'], 'description' => ['nullable', 'string', 'max:2000'], 'current_price' => ['nullable', 'numeric', 'min:0'],
            'financing_markup_pct' => ['nullable', 'numeric', 'min:0', 'max:100'], 'offer_details' => ['nullable', 'string', 'max:500'],
        ], [
            'vin.required' => 'VIN is required.', 'plate_number.required' => 'Plate number is required.', 'engine_number.required' => 'Engine number is required.',
            'chassis_number.required' => 'Chassis number is required.', 'make.required' => 'Make is required.', 'model.required' => 'Model is required.',
            'year.min' => 'Year must be 1900 or later.', 'mileage.min' => 'Mileage cannot be negative.', 'current_price.min' => 'Price cannot be negative.',
            'financing_markup_pct.min' => 'The markup cannot be negative.', 'financing_markup_pct.max' => 'The markup cannot exceed 100%.',
        ]);
        $columns = [];
        foreach ($data as $key => $value) {
            $columns[$key] = is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value;
        }

        return $columns;
    }

    /** createVehicle: the server numbers the car GCE-NNN; one retry covers two simultaneous saves. */
    public function createVehicle(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'marketing_specialist', 403, 'Not authorized');
        $columns = $this->vehicleColumns($request);
        $id = (string) Str::uuid();
        $insert = function () use ($id, $columns) {
            $max = 0;
            foreach (DB::table('vehicles')->where('stock_code', 'like', 'GCE-%')->pluck('stock_code') as $code) {
                if (preg_match('/^GCE-(\d+)$/', trim((string) $code), $m)) {
                    $max = max($max, (int) $m[1]);
                }
            }
            DB::table('vehicles')->insert($columns + ['id' => $id, 'stock_code' => 'GCE-'.str_pad((string) ($max + 1), 3, '0', STR_PAD_LEFT), 'created_at' => now(), 'updated_at' => now()]);
        };
        try {
            DB::transaction($insert);
        } catch (UniqueConstraintViolationException $e) {
            abort_unless(str_contains($e->getMessage(), 'stock_code'), 500);
            DB::transaction($insert);
        }

        return response()->json(['success' => true, 'id' => $id]);
    }

    public function updateVehicle(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'marketing_specialist', 403, 'Not authorized');
        $columns = $this->vehicleColumns($request);
        $id = $request->input('id');
        abort_unless(is_string($id) && Str::isUuid($id) && DB::table('vehicles')->where('id', $id)->exists(), 404, 'Vehicle not found.');
        DB::table('vehicles')->where('id', $id)->update($columns + ['updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    public function publishVehicle(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'marketing_specialist', 403, 'Not authorized');
        $id = (string) $request->input('id');
        abort_unless(DB::table('vehicle_price_proposals')->where('vehicle_id', $id)->where('decision', 'approved')->exists(), 422,
            'Vehicle must have an approved price proposal before publishing.');
        DB::table('vehicles')->where('id', $id)->update(['listing_state' => 'available', 'posted_at' => now(), 'updated_at' => now()]);

        return response()->json(['success' => true]);
    }

    /** proposePrice: a selling price, or a reprice once the car's reconditioning is complete. */
    public function proposePrice(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'marketing_specialist', 403, 'Not authorized');
        $data = $request->validate(['vehicle_id' => ['required', 'uuid'], 'proposed_amount' => ['required', 'numeric', 'min:0'], 'notes' => ['nullable', 'string', 'max:500']],
            ['proposed_amount.min' => 'Amount cannot be negative.', '*' => 'Invalid price proposal.']);
        $userId = $request->user()->id;
        try {
            Trading::run(function () use ($data, $userId) {
                $vehicle = DB::table('vehicles')->where('id', $data['vehicle_id'])->lockForUpdate()->first(['listing_state']);
                abort_unless($vehicle, 404, 'Vehicle not found.');
                $job = DB::table('reconditioning_jobs')->where('vehicle_id', $data['vehicle_id'])->orderByDesc('created_at')->first(['state']);
                abort_if($job && $job->state !== 'completed', 422, "Finish the car's reconditioning before repricing it.");
                // SH-1 / SH-2: a reconditioned car is 'awaiting_price_approval', so it no longer depends on the car
                // still reading 'repairing', and no Sales Manager papers step gates the reprice any more.
                $kind = $job ? 'reprice' : 'selling_price';
                abort_if(DB::table('vehicle_price_proposals')->where('vehicle_id', $data['vehicle_id'])->where('proposal_kind', $kind)->where('decision', 'pending')->exists(), 409,
                    'This vehicle already has a pending price proposal.');
                DB::table('vehicle_price_proposals')->insert([
                    'id' => (string) Str::uuid(), 'vehicle_id' => $data['vehicle_id'], 'proposed_amount' => $data['proposed_amount'], 'proposer_id' => $userId,
                    'decision' => 'pending', 'proposal_kind' => $kind, 'notes' => trim((string) ($data['notes'] ?? '')) ?: null, 'created_at' => now(),
                ]);
                DB::table('vehicles')->where('id', $data['vehicle_id'])->update(['listing_state' => 'awaiting_price_approval', 'updated_at' => now()]);
            });
        } catch (UniqueConstraintViolationException) {
            abort(409, 'This vehicle already has a pending price proposal.');
        }

        return response()->json(['success' => true]);
    }

    /** approvePrice: the CEO decides a selling price, a reprice, or a sell offer's purchase/revised ceiling. */
    public function approvePrice(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'ceo', 403, 'Only the CEO can approve or reject price proposals.');
        $proposalId = (string) $request->input('proposal_id');
        $decision = $request->input('decision');
        abort_unless(in_array($decision, ['approved', 'rejected'], true), 422, 'Invalid proposal decision.');
        $notes = mb_substr(trim((string) $request->input('decision_notes')), 0, 1000) ?: null;
        $setPrice = $request->input('ceiling_amount') ?? $request->input('set_amount');
        $userId = $request->user()->id;
        Trading::run(function () use ($proposalId, $decision, $notes, $setPrice, $userId) {
            $peek = DB::table('vehicle_price_proposals')->where('id', $proposalId)->first(['vehicle_id', 'transaction_id']);
            abort_unless($peek, 409, 'Price proposal is no longer pending.');
            DB::table('vehicles')->where('id', $peek->vehicle_id)->lockForUpdate()->first();
            $proposal = DB::table('vehicle_price_proposals')->where('id', $proposalId)->lockForUpdate()->first();
            abort_if($proposal->decision !== 'pending', 409, 'Price proposal is no longer pending.');
            $ceiling = in_array($proposal->proposal_kind, ['purchase_ceiling', 'revised_ceiling'], true);
            $note = null;
            if ($decision === 'approved' && $setPrice !== null && $setPrice !== '') {
                abort_unless(is_numeric($setPrice) && (float) $setPrice > 0, 422, 'Enter the price.');
                $note = 'CEO set the '.($ceiling ? 'ceiling' : 'price').' to ₱'.number_format((float) $setPrice).' (proposed ₱'.number_format((float) $proposal->proposed_amount).').';
                $proposal->proposed_amount = (float) $setPrice;
            }
            if ($ceiling) {
                SellFlow::applyCeilingDecision($proposal, $decision, $userId);
            }
            DB::table('vehicle_price_proposals')->where('id', $proposalId)->where('decision', 'pending')->update([
                'decision' => $decision, 'decider_id' => $userId, 'decision_date' => now(),
                'decision_notes' => implode(' ', array_filter([$note, $notes])) ?: null,
            ] + ($note ? ['proposed_amount' => $proposal->proposed_amount] : []));
            if (! $ceiling) {
                $vehicle = DB::table('vehicles')->where('id', $proposal->vehicle_id)->first(['posted_at']);
                // SH-1: a rejected reprice sends the car back to 'awaiting_price_approval' (where the Marketing
                // Specialist proposes again), never to 'repairing': the repairs are already done.
                $fallback = $proposal->proposal_kind === 'reprice' ? 'awaiting_price_approval' : 'draft';
                DB::table('vehicles')->where('id', $proposal->vehicle_id)->update(
                    ($decision === 'approved' ? ['current_price' => $proposal->proposed_amount] : [])
                    + ['listing_state' => $decision === 'approved' ? 'available' : $fallback, 'updated_at' => now()]
                    + ($decision === 'approved' && ! $vehicle?->posted_at ? ['posted_at' => now()] : []),
                );                if ($decision === 'rejected' && $proposal->proposer_id) {
                    Trading::notify(['userId' => $proposal->proposer_id], 'price_revision_requested', 'Price revision requested',
                        $notes ? "The CEO asked for a new price: {$notes}" : 'The CEO asked for a new price.', $proposal->vehicle_id, 'vehicles');
                }
            }
            Trading::audit($userId, "price_{$decision}", 'vehicle_price_proposal', $proposalId, "Price proposal {$proposalId} for vehicle {$proposal->vehicle_id} was {$decision}");
        });

        return response()->json(['success' => true]);
    }

    public function archiveVehicle(Request $request, string $vehicleId): JsonResponse
    {
        abort_unless($this->role($request) === 'marketing_specialist', 403, 'Not authorized');
        Trading::run(function () use ($vehicleId) {
            $state = DB::table('vehicles')->where('id', $vehicleId)->lockForUpdate()->value('listing_state');
            abort_unless($state, 404, 'Vehicle not found.');
            abort_if(in_array($state, ['reserved', 'sold', 'awaiting_price_approval'], true), 409, 'Reserved, sold, or awaiting-approval vehicles cannot be archived.');
            DB::table('vehicles')->where('id', $vehicleId)->update(['listing_state' => 'archived', 'updated_at' => now()]);
        });

        return response()->json(['success' => true]);
    }

    public function createInspection(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'mechanic', 403, 'Not authorized');
        $data = $request->validate(['vehicle_id' => ['required', 'uuid', 'exists:vehicles,id'], 'condition_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'findings' => ['nullable', 'string', 'max:2000'], 'recommendation' => ['nullable', 'string', 'max:2000']], ['*' => 'Invalid inspection details.']);
        $id = (string) Str::uuid();
        DB::table('vehicle_inspections')->insert([
            'id' => $id, 'vehicle_id' => $data['vehicle_id'], 'mechanic_id' => $request->user()->id, 'condition_score' => $data['condition_score'] ?? null,
            'findings' => ($data['findings'] ?? null) ?: null, 'recommendation' => ($data['recommendation'] ?? null) ?: null, 'created_at' => now(),
        ]);

        return response()->json(['success' => true, 'id' => $id]);
    }

    /** submitChecklistAnswer: one answer per entry; one part replacement per answer (kept under the row lock). */
    public function submitChecklistAnswer(Request $request): JsonResponse
    {
        abort_unless($this->role($request) === 'mechanic', 403, 'Not authorized');
        $data = $request->validate([
            'inspection_id' => ['required', 'uuid'], 'checklist_entry_id' => ['required', 'uuid'], 'status' => ['required', 'in:good,for_repair,for_replacement'],
            'notes' => ['nullable', 'string', 'max:500'], 'item_name' => ['nullable', 'string', 'max:200'], 'brand' => ['nullable', 'string', 'max:100'],
            'estimated_cost' => ['nullable', 'numeric', 'min:0'],
        ], ['*' => 'Invalid checklist answer.']);
        abort_unless(DB::table('vehicle_inspections')->where('id', $data['inspection_id'])->exists(), 404, 'Inspection not found.');
        DB::transaction(function () use ($data) {
            DB::table('inspection_checklist_results')->upsert([[
                'id' => (string) Str::uuid(), 'inspection_id' => $data['inspection_id'], 'checklist_entry_id' => $data['checklist_entry_id'],
                'status' => $data['status'], 'notes' => ($data['notes'] ?? null) ?: null, 'answered_at' => now(),
            ]], ['inspection_id', 'checklist_entry_id'], ['status', 'notes', 'answered_at']);
            $answer = DB::table('inspection_checklist_results')->where('inspection_id', $data['inspection_id'])
                ->where('checklist_entry_id', $data['checklist_entry_id'])->lockForUpdate()->value('id');
            if (in_array($data['status'], ['for_repair', 'for_replacement'], true) && ! empty($data['item_name'])) {
                // ponytail: part_replacements.checklist_answer_id has no unique key (also not in Supabase); the answer row lock keeps one row.
                DB::table('part_replacements')->updateOrInsert(['checklist_answer_id' => $answer], [
                    'item_name' => $data['item_name'], 'brand' => ($data['brand'] ?? null) ?: null, 'estimated_cost' => $data['estimated_cost'] ?? null,
                ] + (DB::table('part_replacements')->where('checklist_answer_id', $answer)->exists() ? [] : ['id' => (string) Str::uuid(), 'recorded_at' => now()]));
            }
        });

        return response()->json(['success' => true]);
    }
}
