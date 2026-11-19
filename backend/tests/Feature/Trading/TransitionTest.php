<?php

namespace Tests\Feature\Trading;

use App\Jobs\CheckTransactionDocument;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Phase 5: every active buy/sell transition, with the roles and states that may not take it. Ported from the
 * t01 selling, onsite-visit, halfway-queue and delivery e2e specs; repeats must not add history or move twice.
 */
class TransitionTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    private function sellOffer($customer, string $meetup = 'meet_halfway'): string
    {
        $files = [['kind' => 'sell_photo', 'key' => 'photo_paths[]']];
        foreach ([1, 2] as $n) {
            foreach (['front', 'back'] as $side) {
                $files[] = ['kind' => 'valid_id', 'key' => "id_{$side}_path_{$n}"];
            }
        }
        foreach (['official_receipt', 'certificate_of_registration', 'deed_of_sale'] as $kind) {
            $files[] = ['kind' => $kind, 'key' => "{$kind}_path"];
        }
        $prepared = $this->act($customer)->postJson('/api/v1/trading/sell/prepare-uploads', [
            'files' => array_map(fn ($f) => ['kind' => $f['kind'], 'type' => 'image/jpeg', 'size' => 1000], $files),
        ])->assertOk()->json();
        $form = ['make' => 'Honda', 'model' => 'City', 'year' => 2019, 'mileage' => 40000, 'condition' => 'Good', 'offered_amount' => 400000,
            'has_known_issues' => 'no', 'meetup_method' => $meetup, 'meetup_lat' => 14.2, 'meetup_lng' => 121.1, 'owner_number' => '1',
            'transaction_id' => $prepared['transactionId'], 'id_type_1' => 'passport', 'id_type_2' => 'umid'];
        foreach ($files as $i => $file) {
            $grant = $prepared['uploads'][$i];
            $this->again()->post('/api/v1/trading/uploads', ['path' => $grant['path'], 'token' => $grant['token'], 'file' => UploadedFile::fake()->image('a.jpg')])->assertOk();
            if (str_ends_with($file['key'], '[]')) {
                $form[substr($file['key'], 0, -2)][] = $grant['path'];
            } else {
                $form[$file['key']] = $grant['path'];
            }
        }
        $id = $this->again()->postJson('/api/v1/trading/sell', $form)->assertOk()->json('id');
        $this->assertSame('pending', DB::table('transactions')->where('id', $id)->value('current_state'));

        return $id;
    }

    #[Test]
    public function selling_no_issue_branch_reaches_cleared_for_payment(): void
    {
        $seller = $this->customer();
        $ms = $this->account('marketing_specialist');
        $ceo = $this->account('ceo');
        $ci = $this->account('confidential_informant');
        $mechanic = $this->account('mechanic');
        $id = $this->sellOffer($seller);

        // The OCR job ran (sync queue) and, with no provider set up, left the papers for manual review.
        $this->assertSame(0, DB::table('transaction_documents')->where('transaction_id', $id)->where('auto_check_status', 'pending')->count());
        $this->assertSame(4, DB::table('transaction_documents')->where('transaction_id', $id)->where('auto_check_status', 'manual_review')->count(), 'the OR, the CR and each ID front');

        // A ceiling needs verified papers; only the Marketing Specialist verifies a seller's papers.
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 380000])->assertStatus(422);
        $paper = DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', 'deed_of_sale')->value('id');
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $paper, 'decision' => 'verified'])->assertForbidden();
        DB::table('transaction_documents')->where('transaction_id', $id)->where('document_kind', '!=', 'sell_photo')->update(['verification_state' => 'verified']);

        $this->act($ceo)->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 380000])->assertForbidden();
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 380000])->assertOk();
        $history = $this->historyCount($id);
        $this->again()->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 380000])->assertStatus(409);
        $this->assertSame($history, $this->historyCount($id), 'a repeat adds no history');

        $proposal = DB::table('vehicle_price_proposals')->where('transaction_id', $id)->value('id');
        $this->act($ms)->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => $proposal, 'decision' => 'approved'])->assertForbidden();
        $this->act($ceo)->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => $proposal, 'decision' => 'approved'])->assertOk();
        $this->again()->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => $proposal, 'decision' => 'approved'])->assertStatus(409);
        $this->assertSame('approved', DB::table('transactions')->where('id', $id)->value('current_state'));
        $this->assertSame('draft', DB::table('vehicles')->where('id', DB::table('transactions')->where('id', $id)->value('vehicle_id'))->value('listing_state'), 'a ceiling never touches the listing (D3)');

        $agreed = ['transaction_id' => $id, 'agreed_price' => 370000, 'informant_id' => $ci->id, 'mechanic_id' => $mechanic->id, 'schedule' => $this->slot()->toIso8601String(), 'location' => 'SM Calamba'];
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', ['agreed_price' => 390000] + $agreed)->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/trading/sell/record-agreed-price', $agreed)->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/sell/record-agreed-price', $agreed)->assertStatus(409);
        $case = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'acquisition')->value('id');

        $this->act($mechanic)->post('/api/v1/staff/field/report-inspection', ['field_case_id' => $case, 'outcome' => 'no_issues'])->assertStatus(422);
        $this->act($mechanic)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'identity'])->assertForbidden();
        $this->act($ci)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'identity'])->assertOk();
        $this->act($mechanic)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'plate'])->assertOk();
        $this->again()->post('/api/v1/staff/field/report-inspection', ['field_case_id' => $case, 'outcome' => 'no_issues'])->assertOk();
        $this->again()->post('/api/v1/staff/field/report-inspection', ['field_case_id' => $case, 'outcome' => 'no_issues'])->assertStatus(409);
        $this->assertNotNull(DB::table('sell_details')->where('transaction_id', $id)->value('cleared_for_payment_at'));
        $this->assertSame('approved', DB::table('transactions')->where('id', $id)->value('current_state'), 'payment completes it in Phase 6');
    }

    #[Test]
    public function selling_issue_branch_goes_back_to_the_ceo_and_the_seller(): void
    {
        $seller = $this->customer();
        $ms = $this->account('marketing_specialist');
        $ceo = $this->account('ceo');
        $mechanic = $this->account('mechanic');
        $id = $this->sellOffer($seller, 'gce_visit');
        DB::table('transaction_documents')->where('transaction_id', $id)->update(['verification_state' => 'verified']);
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/propose-purchase-ceiling', ['transaction_id' => $id, 'amount' => 380000])->assertOk();
        $this->act($ceo)->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => DB::table('vehicle_price_proposals')->where('transaction_id', $id)->value('id'), 'decision' => 'approved'])->assertOk();
        // A GCE visit sends only the Mechanic, who also confirms the identity.
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-agreed-price', ['transaction_id' => $id, 'agreed_price' => 370000, 'mechanic_id' => $mechanic->id,
            'schedule' => $this->slot()->toIso8601String(), 'location' => 'GCE'])->assertOk();
        $case = DB::table('field_cases')->where('transaction_id', $id)->value('id');
        $this->assertNull(DB::table('field_cases')->where('id', $case)->value('assigned_confidential_informant'));
        $this->act($mechanic)->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'identity'])->assertOk();
        $this->again()->postJson('/api/v1/staff/field/confirm-field-check', ['field_case_id' => $case, 'check' => 'plate'])->assertOk();
        $this->again()->post('/api/v1/staff/field/report-inspection', ['field_case_id' => $case, 'outcome' => 'issue_found', 'issue_description' => 'Worn clutch',
            'repair_estimate' => 15000, 'photos' => [UploadedFile::fake()->image('c.jpg')]])->assertOk();
        $this->assertNull(DB::table('sell_details')->where('transaction_id', $id)->value('cleared_for_payment_at'));

        $report = ['transaction_id' => $id, 'is_profitable' => 'yes', 'profitability_reason' => 'Still a margin', 'recalculated_price' => 350000, 'new_ceiling' => 355000, 'seller_remarks' => 'Clutch'];
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/create-inspection-issue-report', $report)->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/sell/create-inspection-issue-report', $report)->assertStatus(409);
        $this->assertSame('under_review', DB::table('transactions')->where('id', $id)->value('current_state'));
        $revised = DB::table('vehicle_price_proposals')->where('transaction_id', $id)->where('proposal_kind', 'revised_ceiling')->value('id');
        $this->act($ceo)->postJson('/api/v1/staff/vehicles/approve-price', ['proposal_id' => $revised, 'decision' => 'approved'])->assertOk();
        $this->act($ms)->postJson('/api/v1/staff/trading/sell/record-seller-response', ['transaction_id' => $id, 'response' => 'agreed'])->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/sell/record-seller-response', ['transaction_id' => $id, 'response' => 'agreed'])->assertStatus(409);
        $sell = DB::table('sell_details')->where('transaction_id', $id)->first();
        $this->assertEquals(350000, (float) $sell->agreed_price);
        $this->assertNotNull($sell->cleared_for_payment_at, 'issue and no-issue branches both end cleared for payment, waiting for the requester');
    }

    #[Test]
    public function onsite_visit_cash_buy_from_draft_to_approved(): void
    {
        $buyer = $this->customer();
        $sm = $this->account('sales_manager');
        $vehicle = $this->vehicle();
        $id = $this->act($buyer)->postJson('/api/v1/trading/buy', ['vehicle_id' => $vehicle])->assertOk()->json('id');

        // Documents go through the upload endpoint into the transaction's own folder.
        foreach ([['passport', 'front'], ['passport', 'back'], ['umid', 'front'], ['umid', 'back']] as [$type, $side]) {
            $path = "{$id}/valid_id-".Str::random(8).'.jpg';
            $this->again()->post('/api/v1/trading/uploads', ['path' => $path, 'file' => UploadedFile::fake()->image('id.jpg')])->assertOk();
            $this->again()->postJson('/api/v1/trading/purchase-documents', ['transaction_id' => $id, 'document_kind' => 'valid_id', 'id_type' => $type, 'id_side' => $side, 'storage_path' => $path])->assertOk();
        }
        $this->again()->postJson('/api/v1/trading/purchase-documents', ['transaction_id' => $id, 'document_kind' => 'valid_id', 'id_type' => 'passport', 'id_side' => 'front', 'storage_path' => "{$id}/valid_id-x.jpg"])->assertStatus(422);
        $billing = "{$id}/proof_of_billing-".Str::random(8).'.jpg';
        $this->again()->post('/api/v1/trading/uploads', ['path' => $billing, 'file' => UploadedFile::fake()->image('b.jpg')])->assertOk();
        $this->again()->postJson('/api/v1/trading/purchase-documents', ['transaction_id' => $id, 'document_kind' => 'proof_of_billing', 'storage_path' => $billing])->assertOk();

        $other = $this->customer();
        $this->act($other)->post('/api/v1/trading/uploads', ['path' => "{$id}/valid_id-z.jpg", 'file' => UploadedFile::fake()->image('z.jpg')])->assertNotFound();
        $this->again()->getJson("/api/v1/my-transactions/{$id}")->assertNotFound();

        $slot = $this->slot();
        $this->act($buyer)->postJson('/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'schedule' => $slot->toIso8601String()])->assertOk();
        $this->again()->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $id])->assertOk()->assertJson(['success' => true, 'queueState' => null]);
        $this->again()->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $id])->assertStatus(409);
        $this->assertSame('under_review', DB::table('transactions')->where('id', $id)->value('current_state'));

        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertStatus(422);
        foreach (DB::table('transaction_documents')->where('transaction_id', $id)->pluck('id') as $doc) {
            $this->again()->postJson('/api/v1/staff/trading/verify-document', ['document_id' => $doc, 'decision' => 'verified'])->assertOk();
        }
        $this->assertSame('verified', DB::table('purchase_details')->where('transaction_id', $id)->value('document_check_state'));
        $this->act($this->account('marketing_specialist'))->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertForbidden();
        $this->act($this->account('account_manager'))->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertForbidden();
        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertOk();
        $history = $this->historyCount($id);
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'approved'])->assertStatus(409);
        $this->assertSame($history, $this->historyCount($id));
        // Mark Sold waits for a recorded payment and the papers.
        $this->again()->postJson('/api/v1/staff/trading/transition', ['id' => $id, 'to_state' => 'completed'])->assertStatus(422);
        $this->assertSame('available', DB::table('vehicles')->where('id', $vehicle)->value('listing_state'));
    }

    #[Test]
    public function halfway_queue_keeps_one_active_buyer_and_promotes_after_a_decision(): void
    {
        $vehicle = $this->vehicle();
        $sm = $this->account('sales_manager');
        [$a, $b] = [$this->customer(), $this->customer()];
        $first = $this->buyRequest($a, $vehicle, 'cash', 'meetup', $this->slot(3, 10));
        $second = $this->buyRequest($b, $vehicle, 'cash', 'meetup', $this->slot(3, 11));
        $this->buyerDocuments($first, $a->id);
        $this->buyerDocuments($second, $b->id);

        $this->act($a)->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $first])->assertOk()->assertJson(['queueState' => 'active']);
        $this->act($b)->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $second])->assertOk()->assertJson(['queueState' => 'on_hold']);
        $this->assertSame('pending', DB::table('transactions')->where('id', $second)->value('current_state'));

        $this->act($sm)->postJson('/api/v1/staff/trading/promote', ['transaction_id' => $second])->assertStatus(409);
        $this->act($b)->postJson('/api/v1/staff/trading/promote', ['transaction_id' => $second])->assertForbidden();
        $this->act($sm)->postJson('/api/v1/staff/trading/transition', ['id' => $first, 'to_state' => 'rejected', 'reason' => 'Not legit'])->assertOk();
        $this->assertNull(DB::table('transactions')->where('id', $first)->value('queue_state'), 'an ended request leaves the queue');
        $this->assertSame('cancelled', DB::table('viewing_arrangements')->where('purchase_transaction_id', $first)->value('confirmation_state'));
        $this->again()->postJson('/api/v1/staff/trading/promote', ['transaction_id' => $second])->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/promote', ['transaction_id' => $second])->assertStatus(409);
        $row = DB::table('transactions')->where('id', $second)->first();
        $this->assertSame(['active', 'under_review'], [$row->queue_state, $row->current_state]);
    }

    #[Test]
    public function customer_cancel_respects_the_five_hour_rule_and_frees_the_slot(): void
    {
        $vehicle = $this->vehicle();
        $buyer = $this->customer();
        $soon = $this->buyRequest($buyer, $vehicle, 'cash', 'meetup', \Carbon\CarbonImmutable::now()->addHours(3), ['current_state' => 'approved', 'queue_state' => 'active']);
        $this->act($buyer)->postJson('/api/v1/trading/cancel', ['id' => $soon])->assertStatus(422);

        $later = $this->buyRequest($this->customer(), $this->vehicle(), 'cash', 'gce_visit', $this->slot(), ['current_state' => 'under_review']);
        $owner = DB::table('transactions')->where('id', $later)->value('customer_id');
        $this->act(\App\Models\User::find($owner))->postJson('/api/v1/trading/cancel', ['id' => $later, 'reason' => 'Changed my mind'])->assertOk();
        $this->again()->postJson('/api/v1/trading/cancel', ['id' => $later])->assertStatus(409);
        $this->assertSame('cancelled', DB::table('transactions')->where('id', $later)->value('current_state'));
        $this->assertSame('cancelled', DB::table('viewing_arrangements')->where('purchase_transaction_id', $later)->value('confirmation_state'));
        $this->act($this->customer())->postJson('/api/v1/trading/cancel', ['id' => $soon])->assertNotFound();
    }

    #[Test]
    public function delivery_runs_from_terms_to_delivered_with_its_gates(): void
    {
        $vehicle = $this->vehicle(600000);
        $buyer = $this->customer('010000000'); // Luzon: fee ₱8,000–₱10,000
        $sm = $this->account('sales_manager');
        $ha = $this->account('head_accountant');
        $ci = $this->account('confidential_informant');
        $security = $this->account('head_security');
        $id = $this->buyRequest($buyer, $vehicle, 'cash', 'delivery', $this->slot(9), ['current_state' => 'approved', 'queue_state' => 'active']);

        $this->act($sm)->postJson('/api/v1/staff/trading/delivery-terms', ['transaction_id' => $id, 'serviceable' => 'yes', 'delivery_fee' => 5000])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/trading/delivery-terms', ['transaction_id' => $id, 'serviceable' => 'yes', 'delivery_fee' => 9000])->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/delivery-terms', ['transaction_id' => $id, 'serviceable' => 'yes', 'delivery_fee' => 9000])->assertStatus(409);
        $this->assertEquals(60000, (float) DB::table('purchase_details')->where('transaction_id', $id)->value('downpayment_amount'));

        $team = ['transaction_id' => $id, 'informant_id' => $ci->id, 'head_security_id' => $security->id];
        $this->again()->postJson('/api/v1/staff/trading/delivery-case', $team)->assertStatus(422);
        $this->payment($id, 'delivery_fee', 9000, $ha->id);
        $this->payment($id, 'downpayment', 60000, $ha->id);
        $this->again()->postJson('/api/v1/staff/trading/delivery-case', $team)->assertOk();
        $this->again()->postJson('/api/v1/staff/trading/delivery-case', $team)->assertStatus(409);
        $case = DB::table('field_cases')->where('transaction_id', $id)->where('case_kind', 'delivery')->value('id');

        $this->act($ci)->postJson('/api/v1/staff/field/advance-delivery-status', ['field_case_id' => $case])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/trading/handover/release-papers-to-ci', ['transaction_id' => $id])->assertOk();
        $this->act($this->account('mechanic'))->postJson('/api/v1/staff/field/advance-delivery-status', ['field_case_id' => $case])->assertForbidden();
        foreach (['dispatched', 'in_transit', 'arriving', 'delivered'] as $status) {
            $this->act($ci)->postJson('/api/v1/staff/field/advance-delivery-status', ['field_case_id' => $case])->assertOk();
            $this->assertSame($status, DB::table('field_cases')->where('id', $case)->value('delivery_status'));
        }
        $this->again()->postJson('/api/v1/staff/field/advance-delivery-status', ['field_case_id' => $case])->assertStatus(409);
        $this->assertSame('completed', DB::table('field_cases')->where('id', $case)->value('state'));
    }

    #[Test]
    public function financed_car_cannot_be_sold_with_unpaid_installments(): void
    {
        $vehicle = $this->vehicle();
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $vehicle, 'financing', 'gce_visit', null, ['current_state' => 'approved', 'flow_status' => 'financing_active']);
        $account = (string) Str::uuid();
        DB::table('installment_accounts')->insert(['id' => $account, 'purchase_transaction_id' => $id, 'financed_total' => 550000, 'opening_balance' => 500000, 'start_date' => now()->toDateString(), 'state' => 'active']);
        DB::table('installments')->insert(['id' => (string) Str::uuid(), 'account_id' => $account, 'sequence_no' => 1, 'due_date' => now()->addMonth()->toDateString(), 'amount_due' => 50000, 'state' => 'upcoming']);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        \App\Services\Trading\Trading::markVehicleSold($vehicle);
    }

    #[Test]
    public function document_check_records_pending_then_the_ocr_result(): void
    {
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $this->vehicle());
        $path = "{$id}/valid_id-front.jpg";
        Storage::disk('local')->put("transaction-documents/{$path}", UploadedFile::fake()->image('id.jpg')->getContent());
        $doc = (string) Str::uuid();
        DB::table('transaction_documents')->insert(['id' => $doc, 'transaction_id' => $id, 'document_kind' => 'valid_id', 'id_type' => 'passport', 'id_side' => 'front',
            'storage_path' => $path, 'uploader_id' => $buyer->id, 'verification_state' => 'pending', 'auto_check_status' => 'pending', 'upload_date' => now()]);
        // Config, not env(): hosts run config:cache, which leaves env() empty outside config files.
        config(['services.document_check.valid_id' => ['provider' => 'ocrspace', 'key' => 'test-key']]);
        Http::fake(['api.ocr.space/*' => Http::sequence()->push(['ParsedResults' => [['ParsedText' => 'REPUBLIC OF THE PHILIPPINES PASAPORTE PASSPORT']]])->push(['ParsedResults' => [['ParsedText' => 'GROCERY RECEIPT']]])]);
        app()->call([new CheckTransactionDocument($doc, 'valid_id', 'passport'), 'handle']);
        $this->assertSame('verified', DB::table('transaction_documents')->where('id', $doc)->value('auto_check_status'));

        app()->call([new CheckTransactionDocument($doc, 'valid_id', 'passport'), 'handle']);
        $this->assertSame('failed', DB::table('transaction_documents')->where('id', $doc)->value('auto_check_status'));

        (new CheckTransactionDocument($doc, 'valid_id', 'passport'))->failed(new \RuntimeException('timeout'));
        $this->assertSame('manual_review', DB::table('transaction_documents')->where('id', $doc)->value('auto_check_status'));
    }
}
