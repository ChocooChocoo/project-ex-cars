<?php

namespace Tests\Feature\Trading;

use App\Services\Trading\SellFlow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 6 (SH-6, SH-5): an approved revised ceiling is a MAXIMUM, not the price. The Marketing Specialist
 * renegotiates, records the price the seller actually accepted under that ceiling, and every downstream screen
 * reads `sell_details.agreed_price`. The seller never learns the ceiling.
 */
class SellNegotiationTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    /** A submitted sell offer waiting for the first ceiling proposal ($meetup = meet_halfway|gce_visit). */
    private function sellOffer($customer, string $meetup = 'gce_visit'): string
    {
        $files = [['kind' => 'sell_photo', 'key' => 'photo_paths[]']];
        foreach ([1, 2] as $n) {
            foreach (['front', 'back'] as $side) {
                $files[] = ['kind' => 'valid_id', 'key' => "id_{$side}_path_{$n}"];
            }
        }
        $prepared = $this->act($customer)->postJson('/api/v1/trading/sell/prepare-uploads', [
            'files' => array_map(fn ($f) => ['kind' => $f['kind'], 'type' => 'image/jpeg', 'size' => 1000], $files),
        ])->assertOk()->json();
        $form = ['make' => 'Honda', 'model' => 'City', 'year' => 2019, 'mileage' => 40000, 'condition' => 'Good', 'offered_amount' => 400000,
            'has_known_issues' => 'no', 'meetup_method' => $meetup, 'meetup_lat' => 14.2, 'meetup_lng' => 121.1, 'owner_number' => '1',
            'transaction_id' => $prepared['transactionId'], 'id_type_1' => 'passport', 'id_type_2' => 'umid',
            'papers_checklist' => ['official_receipt' => 'has', 'certificate_of_registration' => 'has', 'deed_of_sale' => 'has'], 'signed_id_copies' => 'yes'];
        foreach ($files as $i => $file) {
            $grant = $prepared['uploads'][$i];
            $this->again()->post('/api/v1/trading/uploads', ['path' => $grant['path'], 'token' => $grant['token'], 'file' => UploadedFile::fake()->image('a.jpg')])->assertOk();
            if (str_ends_with($file['key'], '[]')) {
                $form[substr($file['key'], 0, -2)][] = $grant['path'];
            } else {
                $form[$file['key']] = $grant['path'];
            }
        }

        return $this->again()->postJson('/api/v1/trading/sell', $form)->assertOk()->json('id');
    }

    /** SH-7: a published system → part checklist so the Mechanic can report the inspection (created once). */
    private function checklistPart(): string
    {
        $existing = DB::table('inspection_checklist_nodes')->where('level', 'part')->value('id');
        if ($existing) {
            return (string) $existing;
        }
        $systemId = (string) Str::uuid();
        DB::table('inspection_checklist_nodes')->insert(['id' => $systemId, 'parent_id' => null, 'level' => 'system', 'name' => 'Brakes', 'display_order' => 0]);
        $partId = (string) Str::uuid();
        DB::table('inspection_checklist_nodes')->insert(['id' => $partId, 'parent_id' => $systemId, 'level' => 'part', 'name' => 'Brake Pads', 'display_order' => 1]);

        return $partId;
    }

    #[Test]
    public function the_approved_ceiling_prefers_a_revised_ceiling_over_the_purchase_ceiling_it_replaced(): void
    {
        // Two proposals can carry the same timestamp (a fast hand-off, or a test that mints them in one second).
        // The revision is the newer decision, so it is the limit — never the larger purchase ceiling it replaced.
        $row = fn (string $kind, float $amount, string $createdAt) => (object) [
            'proposal_kind' => $kind, 'decision' => 'approved', 'proposed_amount' => $amount, 'created_at' => $createdAt,
        ];
        $sameSecond = '2026-11-20 10:00:00.000000';
        $this->assertSame(415000.0, SellFlow::approvedCeiling([
            $row('purchase_ceiling', 450000, $sameSecond), $row('revised_ceiling', 415000, $sameSecond),
        ]));
        // Insertion order must not matter either.
        $this->assertSame(415000.0, SellFlow::approvedCeiling([
            $row('revised_ceiling', 415000, $sameSecond), $row('purchase_ceiling', 450000, $sameSecond),
        ]));
        // A later approval always wins regardless of kind.
        $this->assertSame(500000.0, SellFlow::approvedCeiling([
            $row('revised_ceiling', 415000, $sameSecond), $row('purchase_ceiling', 500000, '2026-11-21 10:00:00.000000'),
        ]));
    }

    /**
     * A sell offer driven to the second negotiation: purchase ceiling approved, price agreed, the inspection found
     * an issue, and the Marketing Specialist filed the revised ceiling. Returns the transaction id.
     */
    private function atSecondNegotiation(string $meetup = 'gce_visit', float $newCeiling = 415000): array
    {
        $seller = $this->customer();
        $ms = $this->account('marketing_specialist');
        $ceo = $this->account('ceo');
        $mechanic = $this->account('mechanic');
        $ci = $this->account('confidential_informant');
        $id = $this->sellOffer($seller, $meetup);
        DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')->update(['verification_state' => 'verified']);

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 450000])->assertOk();
        $this->act($ceo)->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => DB::table('vehicle_price_proposals')->where('transaction_id', $id)->value('id'), 'decision' => 'approved',
        ])->assertOk();

        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', ['transaction_id' => $id, 'agreed_price' => 440000,
            'mechanic_id' => $mechanic->id, 'informant_id' => $meetup === 'gce_visit' ? null : $ci->id,
            'schedule' => $this->slot()->toIso8601String()])->assertOk();

        $case = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'acquisition')->value('id');
        $part = $this->checklistPart();
        // A Meet Halfway sends the CI too, and the CI confirms the seller's identity; a GCE visit sends only the
        // Mechanic, who confirms both checks.
        $this->act($meetup === 'gce_visit' ? $mechanic : $ci)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'identity'])->assertOk();
        $this->act($mechanic)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'plate'])->assertOk();
        $this->again()->post('/api/v1/staff/field/report-inspection', ['field_case_id' => $case, 'results' => json_encode([
            ['node_id' => $part, 'status' => 'for_repair', 'cost' => '15000', 'note' => 'Worn clutch'],
        ]), "result_photo_{$part}" => [UploadedFile::fake()->image('c.jpg')]])->assertOk();

        // SH-6: the report carries the revised ceiling and the remarks, no recalculated price.
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/create-inspection-issue-report', ['transaction_id' => $id, 'is_profitable' => 'yes',
            'profitability_reason' => 'Still a margin', 'new_ceiling' => $newCeiling, 'seller_remarks' => 'The timing belt needs replacing.'])->assertOk();

        return ['id' => $id, 'seller' => $seller, 'ms' => $ms, 'ceo' => $ceo];
    }

    private function approvedRevisedProposal(string $id): string
    {
        return (string) DB::table('vehicle_price_proposals')->where('transaction_id', $id)
            ->where('proposal_kind', 'revised_ceiling')->latest('created_at')->value('id');
    }

    #[Test]
    public function ceo_approval_of_a_revised_ceiling_leaves_the_agreed_price_unchanged_and_opens_the_negotiation(): void
    {
        $sale = $this->atSecondNegotiation(newCeiling: 415000);
        $id = $sale['id'];
        $before = DB::table('sell_details')->where('transaction_id', $id)->first(['agreed_price', 'cleared_for_payment_at']);

        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();

        // The ₱415,000 ceiling is a limit, so approving it changes no price and clears nothing yet.
        $after = DB::table('sell_details')->where('transaction_id', $id)->first(['agreed_price', 'cleared_for_payment_at']);
        $this->assertEquals((float) $before->agreed_price, (float) $after->agreed_price);
        $this->assertEquals(440000, (float) $after->agreed_price, 'the price agreed before the inspection is untouched by the ceiling');
        $this->assertNull($after->cleared_for_payment_at);
        $this->assertSame('approved', DB::table('transactions')->where('id', $id)->value('current_state'));

        // The second negotiation is open: the report waits for the seller's answer with no agreed price recorded.
        $report = DB::table('inspection_issue_reports')->where('transaction_id', $id)->first();
        $this->assertSame('approved', DB::table('vehicle_price_proposals')->where('id', $report->proposal_id)->value('decision'));
        $this->assertNull($report->seller_response);
        $this->assertNull($report->recalculated_price, 'SH-6: the report collects no recalculated price');
    }

    #[Test]
    public function recording_an_agreed_price_under_the_revised_ceiling_writes_it_and_clears_the_car_for_payment(): void
    {
        $sale = $this->atSecondNegotiation(newCeiling: 415000);
        $id = $sale['id'];
        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();

        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed', 'agreed_price' => 400000,
        ])->assertOk();

        $sell = DB::table('sell_details')->where('transaction_id', $id)->first(['agreed_price', 'cleared_for_payment_at']);
        $this->assertEquals(400000, (float) $sell->agreed_price);
        $this->assertNotNull($sell->cleared_for_payment_at);
        $this->assertSame('agreed', DB::table('inspection_issue_reports')->where('transaction_id', $id)->value('seller_response'));
        $this->assertNotNull(DB::table('inspection_issue_reports')->where('transaction_id', $id)->value('seller_response_at'));

        // SH-5: the price that flows on is the negotiated one, and the payment team is told the amount to pay.
        $body = (string) DB::table('notifications')->where('kind', 'sell_ready_for_payment')->value('body');
        $this->assertStringContainsString('₱400,000', $body);
        $this->assertStringNotContainsString('415,000', $body, 'SH-6: the ceiling is never mentioned to the payment team');
    }

    #[Test]
    public function an_agreed_price_above_the_approved_ceiling_is_rejected_with_the_ceiling_message(): void
    {
        $sale = $this->atSecondNegotiation(newCeiling: 415000);
        $id = $sale['id'];
        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();
        $before = DB::table('sell_details')->where('transaction_id', $id)->value('agreed_price');

        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed', 'agreed_price' => 416000,
        ])->assertStatus(422)->assertJson(['message' => 'The agreed price cannot exceed the approved ceiling of ₱415,000.']);

        // Nothing moved: no price, no answer, no clearance, still open for a correct entry.
        $this->assertEquals((float) $before, (float) DB::table('sell_details')->where('transaction_id', $id)->value('agreed_price'));
        $this->assertNull(DB::table('sell_details')->where('transaction_id', $id)->value('cleared_for_payment_at'));
        $this->assertNull(DB::table('inspection_issue_reports')->where('transaction_id', $id)->value('seller_response'));

        // Exactly the ceiling is allowed (comparison is on centavos, not on formatted strings).
        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed', 'agreed_price' => 415000,
        ])->assertOk();
        $this->assertEquals(415000, (float) DB::table('sell_details')->where('transaction_id', $id)->value('agreed_price'));
    }

    #[Test]
    public function an_agreed_response_without_a_price_is_refused(): void
    {
        $sale = $this->atSecondNegotiation();
        $id = $sale['id'];
        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();

        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed',
        ])->assertStatus(422);
        $this->assertNull(DB::table('inspection_issue_reports')->where('transaction_id', $id)->value('seller_response'));

        // A refusal needs no price and still ends the offer.
        $this->again()->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'refused',
        ])->assertOk();
        $this->assertSame('cancelled', DB::table('transactions')->where('id', $id)->value('current_state'));
        $this->assertSame('seller_refused', DB::table('transactions')->where('id', $id)->value('flag'));
    }

    #[Test]
    public function the_seller_never_sees_the_ceiling_in_the_payload_or_the_notices(): void
    {
        $sale = $this->atSecondNegotiation(newCeiling: 415000);
        $id = $sale['id'];
        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();

        // The customer payload: the counter-offer card is remarks only, with no ceiling and no price.
        $payload = $this->act($sale['seller'])->getJson("/api/v1/my-transactions/{$id}")->assertOk()->json();
        $counter = $payload['counterOffer'];
        $this->assertSame(['remarks', 'response'], array_keys($counter));
        $this->assertSame('The timing belt needs replacing.', $counter['remarks']);
        $encoded = json_encode($payload);
        $this->assertStringNotContainsString('415000', $encoded);
        $this->assertStringNotContainsString('415,000', $encoded);
        $this->assertStringNotContainsString('new_ceiling', $encoded);

        // The notices the seller receives mention the reduction and the chat, never the ceiling.
        $bodies = DB::table('notifications')->where('recipient_id', $sale['seller']->id)->pluck('body')->implode(' ');
        $this->assertStringContainsString('GCE found issues during inspection', $bodies);
        $this->assertStringContainsString('Marketing Specialist will discuss a revised offer in the chat', $bodies);
        $this->assertStringNotContainsString('415,000', $bodies);
        $this->assertStringNotContainsString('415000', $bodies);

        // The seller's own history reasons stay seller-safe after the second negotiation.
        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed', 'agreed_price' => 400000,
        ])->assertOk();
        $history = $this->act($sale['seller'])->getJson("/api/v1/my-transactions/{$id}")->assertOk()->json('history');
        $reasons = collect($history)->pluck('reason')->filter()->implode(' | ');
        $this->assertStringNotContainsString('415,000', $reasons);
    }

    #[Test]
    public function the_purchase_fund_request_uses_the_negotiated_price_and_not_the_ceiling(): void
    {
        $sale = $this->atSecondNegotiation(newCeiling: 415000);
        $id = $sale['id'];
        $ha = $this->account('head_accountant');
        $this->act($sale['ceo'])->postJson('/api/v1/staff/vehicles/approve-price', [
            'proposal_id' => $this->approvedRevisedProposal($id), 'decision' => 'approved',
        ])->assertOk();
        $this->act($sale['ms'])->postJson('/api/v1/staff/trading/sell/record-seller-response', [
            'transaction_id' => $id, 'response' => 'agreed', 'agreed_price' => 400000,
        ])->assertOk();

        // SH-5: the fund request is the money the seller accepted, not the ₱415,000 ceiling under it.
        $this->act($sale['ms'])->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $id])->assertOk();
        $request = DB::table('disbursement_requests')->where('purchase_transaction_id', $id)->first(['amount_cents', 'purpose']);
        $this->assertSame(40_000_000, (int) $request->amount_cents);
        $this->assertSame('Car payment ₱400,000 (GCE Visit)', $request->purpose);

        // Paid: the seller is paid the negotiated price, and the notice says so.
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => DB::table('disbursement_requests')->where('purchase_transaction_id', $id)->value('id'), 'event_kind' => 'approved'])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => DB::table('disbursement_requests')->where('purchase_transaction_id', $id)->value('id'), 'event_kind' => 'released'])->assertOk();
        $this->act($sale['ms'])->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => DB::table('disbursement_requests')->where('purchase_transaction_id', $id)->value('id')])->assertOk();
        $this->assertSame('GCE paid ₱400000.00 for a seller\'s car.', DB::table('notifications')->where('kind', 'sell_payment_disbursed')->value('body'));
    }

    #[Test]
    public function an_old_issue_report_keeps_its_recalculated_price_in_history(): void
    {
        // SH-6 keeps the column for rows written before this change; the record still reads its figure.
        $sale = $this->atSecondNegotiation();
        $id = $sale['id'];
        DB::table('inspection_issue_reports')->where('transaction_id', $id)->update(['recalculated_price' => 398000]);

        $row = DB::table('inspection_issue_reports')->where('transaction_id', $id)->first(['recalculated_price']);
        $this->assertEquals(398000, (float) $row->recalculated_price);
        $this->assertNull(DB::table('sell_details')->where('transaction_id', $id)->value('cleared_for_payment_at'));
        $this->assertEquals(440000, (float) DB::table('sell_details')->where('transaction_id', $id)->value('agreed_price'),
            'a legacy recalculated price is never copied into the agreed price any more');
    }

    #[Test]
    public function the_field_case_notes_name_the_real_arrangement(): void
    {
        // SN-7 (deferred to this lane): the notes say which arrangement it is, not always "Seller meet-up", and
        // read exactly like the field-case header's own arrangement label.
        foreach (['gce_visit' => 'GCE visit. Agreed price ₱440,000.', 'meet_halfway' => 'Seller meet-up (Meet Halfway). Agreed price ₱440,000.'] as $method => $expected) {
            $sale = $this->atSecondNegotiation($method);
            $notes = DB::table('field_cases')->where('transaction_id', $sale['id'])->where('case_kind', 'acquisition')->value('notes');
            $this->assertSame($expected, $notes, "notes for {$method}");
        }
    }
}
