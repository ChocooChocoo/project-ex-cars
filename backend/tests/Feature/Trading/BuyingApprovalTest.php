<?php

namespace Tests\Feature\Trading;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Phase 9: the Sales Manager's decisions are gated and explained, the commitment downpayment is the fixed 10%,
 * and a full-payment GCE visit can request its papers without a checked payment (BC-8, BC-9, BH-6, BC-4).
 */
class BuyingApprovalTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    #[Test]
    public function the_staff_page_reports_the_prerequisites_the_approval_gate_enforces(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit', $this->slot(), ['current_state' => 'under_review']);

        // BC-8: one rule behind both answers, so the disabled button and the refused API cannot drift.
        $this->act($sm)->getJson("/api/v1/staff/transactions/{$id}")->assertOk()->assertJsonPath('verifiedPrerequisites', false);
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertStatus(422)
            ->assertJsonPath('message', "Two verified valid IDs and a verified proof of billing are required before approval. Verify the buyer's documents first.");
        $this->assertSame('under_review', DB::table('transactions')->where('id', $id)->value('current_state'));

        // Unverified uploads do not count either: the page still reports false.
        $this->buyerDocuments($id, $buyer->id);
        $this->again()->getJson("/api/v1/staff/transactions/{$id}")->assertJsonPath('verifiedPrerequisites', false);
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertStatus(422);

        DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')->update(['verification_state' => 'verified']);
        $this->again()->getJson("/api/v1/staff/transactions/{$id}")->assertJsonPath('verifiedPrerequisites', false, 'a verified proof of billing is still missing');

        DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'proof_of_billing')->update(['verification_state' => 'verified']);
        $this->again()->getJson("/api/v1/staff/transactions/{$id}")->assertJsonPath('verifiedPrerequisites', true);
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertOk();
        $this->assertSame('approved', DB::table('transactions')->where('id', $id)->value('current_state'));
    }

    #[Test]
    public function a_rejection_without_a_reason_is_impossible(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit', $this->slot(), ['current_state' => 'under_review']);

        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'rejected'])->assertStatus(422)
            ->assertJsonPath('message', 'Give the reason for rejecting this request.');
        // An empty or blank reason is no reason.
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'rejected', 'reason' => '   '])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'rejected', 'reason' => ''])->assertStatus(422);
        $this->assertSame('under_review', DB::table('transactions')->where('id', $id)->value('current_state'));
        $this->assertSame(0, DB::table('transaction_status_history')->where('transaction_id', $id)->where('to_state', 'rejected')->count());

        $this->again()->postJson('/api/v1/staff/trading/transition', [
            'id' => $id, 'to_state' => 'rejected', 'reason' => 'The proof of billing is not in the buyer\'s name.',
        ])->assertOk();
        $this->assertSame('The proof of billing is not in the buyer\'s name.',
            DB::table('transaction_status_history')->where('transaction_id', $id)->where('to_state', 'rejected')->value('reason'));
        $this->assertStringContainsString('Reason: The proof of billing is not in the buyer\'s name.',
            (string) DB::table('notifications')->where('kind', 'buy_request_rejected')->where('recipient_id', $buyer->id)->value('body'));
    }

    #[Test]
    public function a_bank_transfer_meetup_approves_with_the_ten_percent_downpayment_and_ignores_the_typed_amount(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $id = $this->buyRequest($buyer, $this->vehicle(600000), 'bank_transfer', 'meetup', $this->slot(3), ['current_state' => 'under_review']);
        $this->buyerDocuments($id, $buyer->id, 'verified');

        // BH-6: the amount is the fixed 10% of the price, as PaymentRules::downPayment and downPaymentFor() say.
        $this->act($sm)->postJson('/api/v1/staff/trading/transition', [
            'id' => $id, 'to_state' => 'approved', 'downpayment_amount' => '1',
        ])->assertOk();
        $details = DB::table('purchase_details')->where('transaction_id', $id)->first(['downpayment_amount', 'downpayment_due_at']);
        $this->assertEquals(60000, (float) $details->downpayment_amount);
        $this->assertNotNull($details->downpayment_due_at);
        $this->assertSame('buy_downpayment_due', DB::table('notifications')->where('recipient_id', $buyer->id)->value('kind'));
        $this->assertStringContainsString('Pay the downpayment of ₱60,000 through PayMongo before',
            (string) DB::table('notifications')->where('kind', 'buy_downpayment_due')->value('body'));
    }

    #[Test]
    public function a_full_payment_gce_visit_requests_its_papers_without_a_checked_payment_but_a_financing_one_cannot(): void
    {
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');

        // BC-4: a full payment at a GCE visit is settled at the office, so nothing is verified before the papers go.
        $cash = $this->buyRequest($this->customer(), $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $cash])->assertOk();
        $this->assertSame('requested', DB::table('sale_handovers')->where('transaction_id', $cash)->value('papers_status'));

        // A financing sale has its Initial Downpayment to verify, so its papers wait for the Head Accountant.
        $financed = $this->buyRequest($this->customer(), $this->vehicle(), 'financing', 'gce_visit', null, ['current_state' => 'approved']);
        $this->again()->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $financed])->assertStatus(422)
            ->assertJsonPath('message', 'The Head Accountant must check the payment before the papers are requested.');
        $this->payment($financed, 'downpayment', 50000, $ha->id);
        $this->again()->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $financed])->assertOk();

        // An unverified payment does not count: the row still waits for the Head Accountant.
        $awaiting = $this->buyRequest($this->customer(), $this->vehicle(), 'financing', 'gce_visit', null, ['current_state' => 'approved']);
        $this->payment($awaiting, 'downpayment', 50000, null);
        $this->again()->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $awaiting])->assertStatus(422);
        $this->assertNull(DB::table('sale_handovers')->where('transaction_id', $awaiting)->value('papers_status'));
    }

    #[Test]
    public function marking_a_cash_gce_visit_sold_notifies_the_head_accountant_with_the_sale(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $vehicle = $this->vehicle(500000);
        $id = $this->buyRequest($buyer, $vehicle, 'cash', 'gce_visit', $this->slot(), ['current_state' => 'approved']);
        $this->buyerDocuments($id, $buyer->id, 'verified');
        $this->payment($id, 'full', 500000, null);
        DB::table('sale_handovers')->insert(['transaction_id' => $id, 'papers_status' => 'received']);
        // BC-2: a cash GCE visit is now signed too; Mark Sold waits for the signature.
        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'completed'])
            ->assertStatus(422)->assertJson(['message' => 'The buyer must sign the contract before the car is marked sold.']);
        DB::table('sale_handovers')->where('transaction_id', $id)->update(['contract_state' => 'signed', 'contract_signed_at' => now()]);

        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'completed'])->assertOk();
        $this->assertSame('sold', DB::table('vehicles')->where('id', $vehicle)->value('listing_state'), 'the car leaves the showroom');

        // BC-4: the Head Accountant gets the car, the buyer, the price and the method so the payment reaches them.
        $notice = DB::table('notifications')->where('kind', 'sale_completed')->first();
        $this->assertNotNull($notice);
        $this->assertSame('head_accountant', $notice->recipient_role);
        $this->assertSame($id, $notice->reference_id);
        $this->assertStringContainsString('2021 Toyota Vios', (string) $notice->body);
        $this->assertStringContainsString((string) DB::table('profiles')->where('id', $buyer->id)->value('full_name'), (string) $notice->body);
        $this->assertStringContainsString('₱500,000', (string) $notice->body);
        $this->assertStringContainsString('paid by Cash', (string) $notice->body);
    }
}
