<?php

namespace Tests\Feature\Trading;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Phase 5: the role and record rules the deleted Supabase-mocking vitest suites asserted (customer gate,
 * paperwork, document verification, buyer decline, mechanic assignment, contract signing, papers chain),
 * now checked against the Laravel endpoints that enforce them.
 */
class RulesTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    #[Test]
    public function customer_actions_refuse_staff_and_other_customers(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle());
        foreach (['sales_manager', 'ceo', 'account_manager'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/trading/cancel', ['id' => $id])->assertForbidden();
        }
        $this->act($this->customer())->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit'])->assertNotFound();
        $this->act($this->customer())->getJson("/api/v1/my-transactions/{$id}")->assertNotFound();
        $this->assertSame('pending', DB::table('transactions')->where('id', $id)->value('current_state'));
    }

    #[Test]
    public function buy_details_keep_the_slot_rules_and_the_showroom_price(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(450000));
        $sunday = \Carbon\CarbonImmutable::now('Asia/Manila')->next(\Carbon\CarbonInterface::SUNDAY)->setTime(10, 0)->utc()->toIso8601String();
        $late = $this->slot(3, 22)->toIso8601String();
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'schedule' => $sunday])->assertStatus(422);
        $this->again()->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'schedule' => $late])->assertStatus(422);
        $this->again()->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_option' => 'full', 'payment_method' => 'financing', 'arrangement_kind' => 'gce_visit'])->assertStatus(422);
        $this->again()->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'bank_transfer', 'arrangement_kind' => 'gce_visit', 'final_price' => 1])->assertOk();
        $this->assertEquals(450000, (float) DB::table('purchase_details')->where('transaction_id', $id)->value('final_price'));
        $this->assertNull(DB::table('purchase_details')->where('transaction_id', $id)->value('location'));
    }

    #[Test]
    public function staff_paperwork_and_document_verification_keep_their_owners(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle(), tx: ['current_state' => 'under_review']);
        $this->buyerDocuments($id, $buyer->id);
        $sm = $this->account('sales_manager');
        foreach (['valid_id', 'proof_of_billing'] as $kind) {
            $this->act($sm)->postJson('/api/v1/staff/trading/paperwork', ['transaction_id' => $id, 'document_kind' => $kind])->assertStatus(422);
        }
        $this->act($sm)->post('/api/v1/staff/trading/paperwork', ['transaction_id' => $id, 'document_kind' => 'invoice', 'file' => UploadedFile::fake()->createWithContent('i.pdf', "%PDF-1.4
1 0 obj<<>>endobj
trailer<<>>
%%EOF")])->assertOk();
        $idDoc = DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'valid_id')->value('id');
        foreach (['ceo', 'account_manager'] as $role) {
            $this->act($this->account($role))->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $idDoc, 'decision' => 'verified'])->assertForbidden();
        }
        $this->act($this->account('marketing_specialist'))->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $idDoc, 'decision' => 'verified'])->assertForbidden();
        $this->act($sm)->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $idDoc, 'decision' => 'rejected', 'reason' => 'Blurry'])->assertOk();
        $this->assertSame('Blurry', DB::table('transaction_documents')->where('id', $idDoc)->value('rejection_reason'));
        $this->assertSame('rejected', DB::table('purchase_details')->where('transaction_id', $id)->value('document_check_state'));
        $this->assertSame(1, DB::table('notifications')->where('recipient_id', $buyer->id)->where('kind', 'document_resubmission_requested')->count());
        $this->again()->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $idDoc, 'decision' => 'verified'])->assertStatus(409);
    }

    #[Test]
    public function a_cash_decline_is_refused_once_the_papers_are_requested(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit', $this->slot(), ['current_state' => 'approved']);
        DB::table('sale_handovers')->insert(['transaction_id' => $id, 'papers_status' => 'requested']);
        $this->act($sm)->postJson('/api/v1/staff/trading/buyer-decline', ['transaction_id' => $id])->assertStatus(422);
        DB::table('sale_handovers')->where('transaction_id', $id)->update(['papers_status' => 'returned']);
        $this->again()->postJson('/api/v1/staff/trading/buyer-decline', ['transaction_id' => $id, 'reason' => 'Changed mind'])->assertOk();
        $row = DB::table('transactions')->where('id', $id)->first();
        $this->assertSame(['cancelled', 'declined_by_buyer'], [$row->current_state, $row->flag]);
        $this->assertSame('completed', DB::table('viewing_arrangements')->where('purchase_transaction_id', $id)->value('confirmation_state'));
        $other = $this->buyRequest($this->customer(), $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $other, 'to_state' => 'cancelled'])->assertForbidden();
    }

    #[Test]
    public function only_the_cases_own_informant_or_the_ceo_assigns_its_mechanic(): void
    {
        $ci = $this->account('confidential_informant');
        $mechanic = $this->account('mechanic');
        $case = (string) Str::uuid();
        DB::table('field_cases')->insert(['id' => $case, 'case_kind' => 'delivery', 'state' => 'assigned', 'assigned_confidential_informant' => $ci->id, 'created_at' => now(), 'updated_at' => now()]);
        $this->act($this->account('confidential_informant'))->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => $case, 'mechanic_id' => $mechanic->id])->assertForbidden();
        $this->act($this->account('sales_manager'))->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => $case, 'mechanic_id' => $mechanic->id])->assertForbidden();
        $this->act($ci)->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => $case, 'mechanic_id' => $ci->id])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => (string) Str::uuid(), 'mechanic_id' => $mechanic->id])->assertNotFound();
        $this->again()->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => $case, 'mechanic_id' => $mechanic->id])->assertOk();
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/trading/assign-mechanic', ['field_case_id' => $case, 'mechanic_id' => $mechanic->id])->assertOk();
        $this->assertSame($mechanic->id, DB::table('field_cases')->where('id', $case)->value('mechanic_id'));
    }

    #[Test]
    public function financed_contract_is_written_approved_and_signed_in_order(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');
        $id = $this->buyRequest($buyer, $this->vehicle(), 'financing', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($buyer)->postJson('/api/v1/trading/sign-contract', ['transaction_id' => $id, 'signed_name' => 'Juan'])->assertStatus(422);
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/save-contract', ['transaction_id' => $id, 'body' => 'Terms', 'submit' => '1'])->assertOk();
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/review-contract', ['transaction_id' => $id, 'decision' => 'approve'])->assertForbidden();
        $this->act($ha)->postJson('/api/v1/staff/trading/handover/review-contract', ['transaction_id' => $id, 'decision' => 'approve'])->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/handover/review-contract', ['transaction_id' => $id, 'decision' => 'approve'])->assertStatus(409);
        $this->act($buyer)->postJson('/api/v1/trading/sign-contract', ['transaction_id' => $id, 'signed_name' => ''])->assertStatus(422);
        $this->again()->postJson('/api/v1/trading/sign-contract', ['transaction_id' => $id, 'signed_name' => 'Juan', 'signature_path' => 'elsewhere/signature-1.png'])->assertStatus(422);
        $path = "{$id}/signature-1.png";
        $this->again()->post('/api/v1/trading/uploads', ['path' => $path, 'file' => UploadedFile::fake()->image('s.png')])->assertOk();
        $this->again()->postJson('/api/v1/trading/sign-contract', ['transaction_id' => $id, 'signed_name' => 'Juan', 'signature_path' => $path])->assertOk();
        $this->again()->postJson('/api/v1/trading/sign-contract', ['transaction_id' => $id, 'signed_name' => 'Juan', 'signature_path' => $path])->assertStatus(409);
        $this->assertSame('signed', DB::table('sale_handovers')->where('transaction_id', $id)->value('contract_state'));
        // The buyer reads the contract body only once it is approved.
        $this->act($buyer)->getJson("/api/v1/my-transactions/{$id}")->assertOk()->assertJsonPath('transaction.sale_handovers.contract_body', 'Terms');
    }

    #[Test]
    public function the_gce_visit_papers_chain_needs_a_checked_payment_and_the_ci(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $ci = $this->account('confidential_informant');
        $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $id])->assertStatus(422);
        $this->payment($id, 'full', 500000, $this->account('head_accountant')->id);
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $id])->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/handover/request-papers-release', ['transaction_id' => $id])->assertStatus(409);
        $this->again()->postJson('/api/v1/staff/trading/handover/approve-papers-release', ['transaction_id' => $id])->assertForbidden();
        $this->act($ci)->postJson('/api/v1/staff/trading/handover/approve-papers-release', ['transaction_id' => $id])->assertOk();
        $this->act($sm)->postJson('/api/v1/staff/trading/handover/receive-papers', ['transaction_id' => $id])->assertOk();
        $this->assertSame('received', DB::table('sale_handovers')->where('transaction_id', $id)->value('papers_status'));
        $this->act($ci)->getJson('/api/v1/staff/vehicle-papers')->assertOk()->assertJsonPath('handovers.0.transaction_id', $id);
        $this->act($sm)->getJson('/api/v1/staff/vehicle-papers')->assertForbidden();
    }

    #[Test]
    public function staff_see_a_pending_sell_offer_but_not_a_customers_buy_draft(): void
    {
        $customer = $this->customer();
        $draft = $this->buyRequest($customer, $this->vehicle());
        $offer = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $offer, 'customer_id' => $customer->id, 'created_by' => $customer->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $this->vehicle(0, 'draft'), 'current_state' => 'pending', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        // 00055 hides only unsubmitted buy drafts.
        $this->act($this->account('marketing_specialist'))->getJson("/api/v1/staff/transactions/{$offer}")->assertOk();
        $this->act($this->account('sales_manager'))->getJson("/api/v1/staff/transactions/{$draft}")->assertNotFound();
        $ids = collect($this->act($this->account('ceo'))->getJson('/api/v1/staff/transactions')->assertOk()->json('transactions'))->pluck('id');
        $this->assertTrue($ids->contains($offer));
        $this->assertFalse($ids->contains($draft));
    }

    #[Test]
    public function a_legit_delivery_decline_drafts_the_downpayment_refund_and_a_not_legit_one_forfeits_it(): void
    {
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');
        foreach (['legit' => 1, 'not_legit' => 0] as $classification => $refunds) {
            $buyer = $this->customer();
            $id = $this->buyRequest($buyer, $this->vehicle(), 'cash', 'delivery', $this->slot(9), ['current_state' => 'approved']);
            $this->payment($id, 'downpayment', 50000, $ha->id);
            $this->act($sm)->postJson('/api/v1/staff/trading/buyer-decline', ['transaction_id' => $id])->assertStatus(422);
            $this->again()->postJson('/api/v1/staff/trading/buyer-decline', ['transaction_id' => $id, 'classification' => $classification])->assertOk();
            $this->assertSame($refunds, DB::table('disbursement_requests')->where('purpose', 'like', "%{$id}%")->where('status', 'draft')->count());
            $this->assertSame($classification === 'not_legit', DB::table('purchase_details')->where('transaction_id', $id)->value('downpayment_forfeited_at') !== null);
            $this->assertSame($classification === 'not_legit', (bool) DB::table('customer_standing')->where('account_id', $buyer->id)->value('gce_visit_only'));
        }
    }
}
