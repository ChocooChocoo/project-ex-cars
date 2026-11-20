<?php

namespace Tests\Feature\Operations;

use App\Services\Finance\Disbursements;
use App\Services\Trading\Trading;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 5 (SH-7, SH-4, SH-2, SH-1): the seller meet-up inspection is the part-by-part checklist, the
 * reconditioning report reuses it, the Sales Manager papers step is gone, and a repaired car leaves "Repairing".
 */
class InspectionChecklistTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    /** An acquisition case on an approved sell offer, with both on-site checks confirmed, and its checklist. */
    private function meetupCase(array $sell = []): array
    {
        $seller = $this->customer();
        $mechanic = $this->account('mechanic');
        $ci = $this->account('confidential_informant');
        $vehicle = $this->vehicle(450000, 'draft');
        $tx = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $vehicle, 'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert($sell + ['id' => (string) Str::uuid(), 'transaction_id' => $tx, 'offered_amount' => 500000,
            'agreed_price' => '450000.00', 'meetup_method' => 'gce_visit', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx, 'case_kind' => 'acquisition',
            'assigned_confidential_informant' => $ci->id, 'mechanic_id' => $mechanic->id, 'state' => 'in_progress',
            'identity_confirmed_at' => now(), 'plate_confirmed_at' => now(), 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'vehicle' => $vehicle, 'case' => $case, 'mechanic' => $mechanic, 'ci' => $ci, 'seller' => $seller];
    }

    /** Three published parts under one system and component; returns their ids in display order. */
    private function checklist(int $parts = 3): array
    {
        $systemId = (string) Str::uuid();
        $componentId = (string) Str::uuid();
        DB::table('inspection_checklist_nodes')->insert(['id' => $systemId, 'parent_id' => null, 'level' => 'system', 'name' => 'Engine', 'display_order' => 0]);
        DB::table('inspection_checklist_nodes')->insert(['id' => $componentId, 'parent_id' => $systemId, 'level' => 'component', 'name' => 'Engine Block', 'display_order' => 1]);
        $ids = [];
        foreach (array_slice(['Cylinder Head', 'Pistons', 'Timing Belt'], 0, $parts) as $i => $name) {
            $ids[] = $id = (string) Str::uuid();
            DB::table('inspection_checklist_nodes')->insert(['id' => $id, 'parent_id' => $componentId, 'level' => 'part', 'name' => $name, 'display_order' => 2 + $i]);
        }

        return $ids;
    }

    private function payload(array $ids, array $answers): string
    {
        return json_encode(array_map(fn (string $id) => ['node_id' => $id] + ($answers[$id] ?? ['status' => 'good']), $ids));
    }

    #[Test]
    public function the_inspection_needs_a_status_for_every_leaf_part(): void
    {
        $setup = $this->meetupCase();
        $ids = $this->checklist();
        $mechanic = $setup['mechanic'];
        $url = '/api/v1/staff/field/report-inspection';
        $base = ['field_case_id' => $setup['case']];

        // (a) Nothing at all, then one part missing, then a blank status: all refused, and nothing is written.
        $this->act($mechanic)->post($url, $base)->assertStatus(422)
            ->assertJsonPath('message', 'Answer every part of the checklist before reporting the inspection.');
        $this->again()->post($url, $base + ['results' => $this->payload($ids, [$ids[2] => ['status' => '']])])
            ->assertStatus(422)->assertJsonPath('message', 'Answer every part of the checklist before reporting the inspection.');
        $this->again()->post($url, $base + ['results' => $this->payload([$ids[0], $ids[1]], [])])->assertStatus(422);
        $this->again()->post($url, $base + ['results' => '[]'])->assertStatus(422);
        // An invented node is refused too, so a report cannot be padded.
        $this->again()->post($url, $base + ['results' => $this->payload([$ids[0], $ids[1], $ids[2], (string) Str::uuid()], [])])->assertStatus(422);
        $this->assertSame(0, DB::table('vehicle_inspections')->count());
        $this->assertSame(0, DB::table('inspection_checklist_results')->count());
        $this->assertNull(DB::table('field_cases')->where('id', $setup['case'])->value('inspection_outcome'));

        // A complete all-good report is accepted once and not twice.
        $this->again()->post($url, $base + ['results' => $this->payload($ids, [])])->assertOk();
        $this->assertSame('no_issues', DB::table('field_cases')->where('id', $setup['case'])->value('inspection_outcome'));
        $this->assertNotNull(DB::table('sell_details')->where('transaction_id', $setup['tx'])->value('cleared_for_payment_at'));
        $this->assertSame(3, DB::table('inspection_checklist_results')->count());
        $inspection = DB::table('vehicle_inspections')->where('field_case_id', $setup['case'])->first();
        $this->assertSame([$setup['mechanic']->id, $setup['vehicle']], [$inspection->mechanic_id, $inspection->vehicle_id]);
        $this->again()->post($url, $base + ['results' => $this->payload($ids, [])])->assertStatus(409);
    }

    #[Test]
    public function a_part_that_needs_repair_needs_a_cost_and_a_photo(): void
    {
        $setup = $this->meetupCase(['condition_items' => json_encode([])]);
        $ids = $this->checklist();
        $url = '/api/v1/staff/field/report-inspection';
        $base = ['field_case_id' => $setup['case']];
        $repair = [$ids[0] => ['status' => 'for_repair']];

        // (b) No cost, then a cost but no photo: both refused with the reason the Mechanic needs to see.
        $this->act($setup['mechanic'])->post($url, $base + ['results' => $this->payload($ids, $repair)])->assertStatus(422)
            ->assertJsonPath('message', 'Give the repair cost of every part that needs repair.');
        $this->again()->post($url, $base + ['results' => $this->payload($ids, [$ids[0] => ['status' => 'for_repair', 'cost' => '12000']])])
            ->assertStatus(422)->assertJsonPath('message', 'Attach at least one photo of every part that needs repair.');
        $this->assertSame(0, DB::table('vehicle_inspections')->count(), 'a refused report writes nothing');
        $this->assertSame(0, DB::table('transaction_documents')->where('transaction_id', $setup['tx'])->count());

        // A cost and a photo: accepted, and the photo is filed against its part.
        $this->again()->post($url, $base + [
            'results' => $this->payload($ids, [$ids[0] => ['status' => 'for_repair', 'cost' => '12000', 'note' => 'Worn cams']]),
            "result_photo_{$ids[0]}" => [UploadedFile::fake()->image('cams.jpg')],
        ])->assertOk();
        $case = DB::table('field_cases')->where('id', $setup['case'])->first(['inspection_outcome', 'issue_description', 'repair_estimate']);
        $this->assertSame(['issue_found', '12000.00'], [$case->inspection_outcome, $case->repair_estimate]);
        $this->assertStringContainsString('Cylinder Head', (string) $case->issue_description);
        $this->assertNull(DB::table('sell_details')->where('transaction_id', $setup['tx'])->value('cleared_for_payment_at'));
        $photo = DB::table('transaction_documents')->where('transaction_id', $setup['tx'])->where('document_kind', 'inspection_photo')->first();
        $this->assertSame($ids[0], $photo->note, 'the photo carries its part id');
        $result = DB::table('inspection_checklist_results')->where('checklist_entry_id', $ids[0])->first();
        $this->assertSame(['for_repair', '12000.00', 'Worn cams'], [$result->status, $result->repair_cost, $result->notes]);
    }

    #[Test]
    public function declared_parts_are_marked_and_anything_else_is_a_hidden_issue(): void
    {
        $ids = $this->checklist();
        // The seller ticked Cylinder Head on the sell form; Pistons is a surprise for the Mechanic.
        $setup = $this->meetupCase(['condition_items' => json_encode([$ids[0]])]);

        $this->act($setup['mechanic'])->post('/api/v1/staff/field/report-inspection', [
            'field_case_id' => $setup['case'],
            'results' => $this->payload($ids, [
                $ids[0] => ['status' => 'for_repair', 'cost' => '12000'],
                $ids[1] => ['status' => 'for_repair', 'cost' => '3000'],
            ]),
            "result_photo_{$ids[0]}" => [UploadedFile::fake()->image('cams.jpg')],
            "result_photo_{$ids[1]}" => [UploadedFile::fake()->image('pistons.jpg')],
        ])->assertOk();

        $this->assertSame(1, DB::table('inspection_checklist_results')->where('is_hidden_issue', true)->count());
        $this->assertSame(0, DB::table('inspection_checklist_results')->where('is_hidden_issue', true)->where('checklist_entry_id', $ids[0])->count());
        $this->assertSame(1, DB::table('inspection_checklist_results')->where('is_hidden_issue', true)->where('checklist_entry_id', $ids[1])->count());
        // The backward-compatible fields still read as the old readers expect.
        $this->assertSame('15000.00', DB::table('field_cases')->where('id', $setup['case'])->value('repair_estimate'));

        // The Marketing Specialist's sell flow shows the parts with their photos and declared/hidden flags.
        $ms = $this->account('marketing_specialist');
        $flow = $this->act($ms)->getJson("/api/v1/staff/transactions/{$setup['tx']}")->assertOk()->json('sellFlow');
        $this->assertSame(2, count(array_filter($flow['inspection']['parts'], fn ($p) => $p['status'] === 'for_repair')));
        $this->assertEquals(15000, $flow['inspection']['total']);
        $declared = array_values(array_filter($flow['inspection']['parts'], fn ($p) => $p['status'] === 'for_repair' && ! $p['is_hidden_issue']));
        $hidden = array_values(array_filter($flow['inspection']['parts'], fn ($p) => $p['is_hidden_issue']));
        $this->assertSame(['Cylinder Head'], array_column($declared, 'name'));
        $this->assertSame(['Pistons'], array_column($hidden, 'name'));
        $this->assertSame(1, count($hidden[0]['photos']));
        $this->assertStringContainsString('/api/v1/files/transaction-documents/', $hidden[0]['photos'][0]['url']);

        // The field case reads the same result back, so the card shows what was reported; the tree ships too.
        $pack = $this->act($setup['mechanic'])->getJson("/api/v1/staff/field-cases/{$setup['case']}")->assertOk();
        $this->assertSame(2, count(array_filter($pack->json('inspection.parts'), fn ($p) => $p['status'] === 'for_repair')));
        $this->assertSame(3, count(array_filter($pack->json('checklist'), fn ($node) => $node['level'] === 'part')));
    }

    #[Test]
    public function the_reconditioning_report_reuses_the_inspection_photo_and_keeps_the_papers_step_gone(): void
    {
        $ids = $this->checklist();
        $setup = $this->meetupCase(['condition_items' => json_encode([$ids[0]])]);
        $mechanic = $setup['mechanic'];
        $this->act($mechanic)->post('/api/v1/staff/field/report-inspection', [
            'field_case_id' => $setup['case'],
            'results' => $this->payload($ids, [$ids[0] => ['status' => 'for_repair', 'cost' => '12000']]),
            "result_photo_{$ids[0]}" => [UploadedFile::fake()->image('cams.jpg')],
        ])->assertOk();
        $resultId = DB::table('inspection_checklist_results')->where('checklist_entry_id', $ids[0])->value('id');
        $this->assertNotNull($resultId);

        // GCE pays the seller: an issue puts the car into reconditioning, with its job waiting for a report.
        // The Mechanic cleared nothing for payment here, so the report's revised price does that (Phase 6).
        DB::table('sell_details')->where('transaction_id', $setup['tx'])->update(['cleared_for_payment_at' => now()]);
        $ha = $this->account('head_accountant');
        $ms = $this->account('marketing_specialist');
        $this->act($ms)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $setup['tx']])->assertOk();
        $fund = DB::table('disbursement_requests')->where('purchase_transaction_id', $setup['tx'])->value('id');
        foreach (['approved', 'released'] as $step) {
            $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $fund, 'event_kind' => $step])->assertOk();
        }
        $this->act($ms)->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $fund])->assertOk();
        $job = DB::table('reconditioning_jobs')->where('vehicle_id', $setup['vehicle'])->first();
        $this->assertSame(['repairing', 'awaiting_report'], [DB::table('vehicles')->where('id', $setup['vehicle'])->value('listing_state'), $job->state]);

        // SH-4 / (c): the row names the inspection answer and attaches no photo, so the inspection photo is reused.
        $this->act($mechanic)->postJson('/api/v1/staff/reconditioning/report', ['job_id' => $job->id,
            'status_report' => 'Cylinder head replaced; road tested.',
            'parts' => json_encode([['result_id' => $resultId, 'part_name' => 'Cylinder Head', 'replacement_brand' => 'Genuine', 'estimated_cost' => '12500']]),
        ])->assertOk();
        $part = DB::table('reconditioning_parts')->where('job_id', $job->id)->first();
        $this->assertSame(1250000, (int) $part->estimated_cost_cents);
        $inspectionPhoto = DB::table('transaction_documents')->where('transaction_id', $setup['tx'])->where('document_kind', 'inspection_photo')->value('storage_path');
        $disk = Storage::disk('local');
        $this->assertTrue($disk->exists('reconditioning-receipts/'.$part->photo_path), 'the part photo exists');
        $this->assertSame($disk->get('transaction-documents/'.$inspectionPhoto), $disk->get('reconditioning-receipts/'.$part->photo_path),
            'the inspection photo is reused, byte for byte');
        $this->assertSame(1, DB::table('disbursement_requests')->where('title', 'Reconditioning fund')->count());

        // SH-2: no route, no controller method and no papers column decides the repricing (d).
        $this->assertFalse(method_exists(\App\Http\Controllers\Trading\ReconditioningController::class, 'markPapersProcessed'));
        $papersRoute = collect(app('router')->getRoutes()->getRoutes())
            ->contains(fn ($route) => str_contains($route->uri(), 'reconditioning/papers-processed'));
        $this->assertFalse($papersRoute, 'the papers-processed route is gone');

        // Start, then complete: SH-1 moves the car out of "Repairing" for every role.
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => DB::table('disbursement_requests')
            ->where('title', 'Reconditioning fund')->value('id'), 'event_kind' => 'approved'])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => DB::table('disbursement_requests')
            ->where('title', 'Reconditioning fund')->value('id'), 'event_kind' => 'released'])->assertOk();
        $this->act($mechanic)->postJson('/api/v1/staff/reconditioning/start', ['job_id' => $job->id])->assertOk();
        $this->act($mechanic)->postJson('/api/v1/staff/reconditioning/complete', ['job_id' => $job->id, 'final_report' => 'Done.', 'actual_cost' => '11000'])->assertOk();
        $this->assertSame('awaiting_price_approval', DB::table('vehicles')->where('id', $setup['vehicle'])->value('listing_state'));

        // The Marketing Specialist's "ready for pricing" list finds it there, with no papers step.
        $list = $this->act($ms)->getJson('/api/v1/staff/vehicles')->assertOk();
        $this->assertSame('completed', $list->json("reconditioning_by_vehicle.{$setup['vehicle']}.state"));
        // And a reprice opens from that state, with the papers columns untouched (SH-2 keeps them but ignores them).
        $this->act($ms)->postJson('/api/v1/staff/vehicles/propose-price', ['vehicle_id' => $setup['vehicle'], 'proposed_amount' => 620000])
            ->assertOk()->assertJsonPath('success', true);
        $this->assertSame('reprice', DB::table('vehicle_price_proposals')->where('vehicle_id', $setup['vehicle'])->value('proposal_kind'));
        $this->assertNull(DB::table('reconditioning_jobs')->where('id', $job->id)->value('papers_processed_at'));
    }

    #[Test]
    public function a_rejected_fund_request_lets_the_mechanic_send_a_new_report(): void
    {
        $mechanic = $this->account('mechanic');
        $ha = $this->account('head_accountant');
        $vehicle = $this->vehicle(450000, 'repairing');
        DB::table('reconditioning_jobs')->insert(['id' => $job = (string) Str::uuid(), 'vehicle_id' => $vehicle,
            'state' => 'awaiting_report', 'mechanic_id' => $mechanic->id, 'created_at' => now()]);
        $this->act($mechanic)->post('/api/v1/staff/reconditioning/report', ['job_id' => $job, 'status_report' => 'Needs a new head.',
            'parts' => json_encode([['part_name' => 'Cylinder Head', 'replacement_brand' => 'OEM', 'estimated_cost' => '30000']]),
            'part_photo_0' => UploadedFile::fake()->image('head.jpg')])->assertOk();
        $fund = DB::table('reconditioning_jobs')->where('id', $job)->value('disbursement_id');

        // While the request is open, a second report is refused.
        $this->act($mechanic)->post('/api/v1/staff/reconditioning/report', ['job_id' => $job, 'status_report' => 'Again.',
            'parts' => json_encode([['part_name' => 'Cylinder Head', 'replacement_brand' => 'OEM', 'estimated_cost' => '30000']]),
            'part_photo_0' => UploadedFile::fake()->image('head2.jpg')])->assertStatus(409);

        // BH-4: once the Head Accountant rejects it, the Mechanic reports again and a new request is raised.
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $fund, 'event_kind' => 'rejected', 'notes' => 'Get a second quote.'])->assertOk();
        $this->act($mechanic)->post('/api/v1/staff/reconditioning/report', ['job_id' => $job, 'status_report' => 'Second quote.',
            'parts' => json_encode([['part_name' => 'Cylinder Head', 'replacement_brand' => 'Aftermarket', 'estimated_cost' => '24000']]),
            'part_photo_0' => UploadedFile::fake()->image('head3.jpg')])->assertOk();
        $this->assertSame(2, DB::table('disbursement_requests')->where('title', 'Reconditioning fund')->count());
        $this->assertSame(2400000, (int) DB::table('reconditioning_parts')->where('job_id', $job)->value('estimated_cost_cents'));
        $this->assertNotSame($fund, DB::table('reconditioning_jobs')->where('id', $job)->value('disbursement_id'));
    }

    #[Test]
    public function a_rejected_reprice_returns_the_car_to_awaiting_price_approval(): void
    {
        $ms = $this->account('marketing_specialist');
        $ceo = $this->account('ceo');
        $vehicle = $this->vehicle(450000, 'awaiting_price_approval');
        DB::table('reconditioning_jobs')->insert(['id' => $job = (string) Str::uuid(), 'vehicle_id' => $vehicle,
            'state' => 'completed', 'completed_at' => now(), 'created_at' => now()]);

        $this->act($ms)->postJson('/api/v1/staff/vehicles/propose-price', ['vehicle_id' => $vehicle, 'proposed_amount' => 620000])->assertOk();
        $proposal = DB::table('vehicle_price_proposals')->where('vehicle_id', $vehicle)->value('id');
        $this->act($ceo)->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => $proposal, 'decision' => 'rejected', 'decision_notes' => 'Too high'])
            ->assertOk();

        // SH-1: never back to "repairing" (the repairs are done); the Specialist proposes again from here.
        $this->assertSame('awaiting_price_approval', DB::table('vehicles')->where('id', $vehicle)->value('listing_state'));
        $this->act($ms)->postJson('/api/v1/staff/vehicles/propose-price', ['vehicle_id' => $vehicle, 'proposed_amount' => 600000])->assertOk();
        $this->assertSame(2, DB::table('vehicle_price_proposals')->where('vehicle_id', $vehicle)->count());
    }

    #[Test]
    public function completing_a_reconditioning_does_not_need_a_sales_manager(): void
    {
        // SH-2: the only writers of a reconditioning job are the Mechanic and the Head Accountant (refunds);
        // a Sales Manager call to the old papers endpoint no longer exists at all.
        $sm = $this->account('sales_manager');
        $vehicle = $this->vehicle(450000, 'repairing');
        DB::table('reconditioning_jobs')->insert(['id' => $job = (string) Str::uuid(), 'vehicle_id' => $vehicle,
            'state' => 'in_progress', 'created_at' => now()]);

        $this->act($sm)->postJson('/api/v1/staff/reconditioning/complete', ['job_id' => $job, 'final_report' => 'x', 'actual_cost' => '0'])
            ->assertForbidden();
        $this->assertNotSame('completed', DB::table('reconditioning_jobs')->where('id', $job)->value('state'));

        // The Mechanic completes it directly; the car is ready for pricing straight away.
        $this->act($this->account('mechanic'))->postJson('/api/v1/staff/reconditioning/complete', [
            'job_id' => $job, 'final_report' => 'Done.', 'actual_cost' => '0',
        ])->assertOk();
        $this->assertSame('awaiting_price_approval', DB::table('vehicles')->where('id', $vehicle)->value('listing_state'));
    }
}
