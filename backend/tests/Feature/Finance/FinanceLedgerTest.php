<?php

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Plan Phase 8 (SN-9, BH-4, SH-3, SN-10): the Head Accountant decides a fund request with the car, the deal, the
 * parties, the prices and the payment status in front of them, plus the seller meet-up inspection; a rejection
 * carries its reason to the requester; and every money movement changes Cash on hand exactly once.
 */
class FinanceLedgerTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    /** An approved sell offer with an agreed price, its acquisition field case and the car the deal is about. */
    private function sellOffer(string $meetup = 'gce_visit', array $sell = []): array
    {
        $seller = $this->customer();
        DB::table('profiles')->where('id', $seller->id)->update(['full_name' => 'Ana Dela Cruz']);
        $vehicle = $this->vehicle(450000, 'draft');
        DB::table('vehicles')->where('id', $vehicle)->update(['condition' => 'Good']);
        $tx = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell', 'vehicle_id' => $vehicle,
            'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert($sell + ['id' => (string) Str::uuid(), 'transaction_id' => $tx, 'agreed_price' => '450000.00', 'meetup_method' => $meetup,
            'has_known_issues' => true, 'declared_issues' => 'Worn front tyres', 'created_at' => now(), 'updated_at' => now()]);
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx, 'case_kind' => 'acquisition',
            'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'vehicle' => $vehicle, 'case' => $case, 'seller' => $seller];
    }

    private function released(string $tx, User $ms, User $ha): string
    {
        $this->act($ms)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $tx])->assertOk();
        $id = DB::table('disbursement_requests')->where('purchase_transaction_id', $tx)->value('id');
        foreach (['approved', 'released'] as $step) {
            $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => $step])->assertOk();
        }

        return $id;
    }

    /** The Head Accountant's page, as the Finance screen reads it. */
    private function financePage(User $user): array
    {
        return $this->act($user)->getJson('/api/v1/staff/finance')->assertOk()->json();
    }

    #[Test]
    public function every_fund_request_carries_the_car_deal_parties_prices_and_payment_context(): void
    {
        $sale = $this->sellOffer('meet_halfway');
        $ci = $this->account('confidential_informant');
        DB::table('field_cases')->where('id', $sale['case'])->update(['assigned_confidential_informant' => $ci->id]);
        $this->act($ci)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $sale['tx'], 'travel_cents' => 150_000])->assertOk();

        $row = $this->financePage($this->account('head_accountant'))['disbursements'][0];
        $context = $row['context'];
        $this->assertSame(45_150_000, $row['amount_cents']);
        // Car, transaction and the parties who make the deal.
        $stock = DB::table('vehicles')->where('id', $sale['vehicle'])->value('stock_code');
        $this->assertSame(['stock_code' => $stock, 'year' => 2021, 'make' => 'Toyota', 'model' => 'Vios', 'condition' => 'Good', 'listing_state' => 'draft'],
            $context['vehicle']);
        $this->assertSame(['id' => $sale['tx'], 'kind' => 'sell', 'state' => 'approved', 'arrangement' => 'meet_halfway'], $context['transaction']);
        $this->assertSame(['role' => 'seller', 'name' => 'Ana Dela Cruz'], $context['party']);
        // The agreed price is the final one (Phase 6); this request is that price plus the travel budget.
        $this->assertSame(['agreed_cents' => 45_000_000, 'final_cents' => null, 'requested_cents' => 45_150_000], $context['prices']);
        // A sell offer has no buyer payment; the sell side's condition and declared issues are the context instead.
        $this->assertSame('not_required', $context['payment']['downpayment']['status']);
        $this->assertSame('not_required', $context['payment']['delivery_fee']['status']);
        $this->assertSame(['condition' => 'Good', 'has_known_issues' => true, 'declared_issues' => 'Worn front tyres'], $context['issues']);
    }

    #[Test]
    public function a_buy_fund_shows_the_buyers_prices_and_what_is_paid_so_far(): void
    {
        $buyer = $this->customer();
        DB::table('profiles')->where('id', $buyer->id)->update(['full_name' => 'Ben Santos']);
        $vehicle = $this->vehicle(600000, 'reserved');
        $tx = $this->buyRequest($buyer, $vehicle, 'cash', 'delivery');
        DB::table('purchase_details')->where('transaction_id', $tx)->update(['downpayment_amount' => '60000.00', 'delivery_fee' => '5000.00']);
        $am = $this->account('account_manager');
        $this->act($am)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $tx, 'amount_cents' => 5_000_000])->assertOk();
        $fund = DB::table('disbursement_requests')->where('purchase_transaction_id', $tx)->value('id');
        // The delivery fee is paid, the downpayment is not, so the two charges report differently.
        $this->payment($tx, 'delivery_fee', 5000, $this->account('head_accountant')->id);

        $context = $this->financePage($this->account('head_accountant'))['disbursements'][0]['context'];
        $this->assertSame(['role' => 'buyer', 'name' => 'Ben Santos'], $context['party']);
        $this->assertSame(60_000_000, $context['prices']['final_cents']);
        $this->assertSame(5_000_000, $context['prices']['requested_cents']);
        $this->assertSame('cash', $context['payment']['method']);
        $this->assertSame('full', $context['payment']['option']);
        $this->assertSame(['amount_cents' => 6_000_000, 'status' => 'pending'], $context['payment']['downpayment']);
        $this->assertSame(['amount_cents' => 500_000, 'status' => 'paid'], $context['payment']['delivery_fee']);
        $this->assertSame(500_000, $context['payment']['received_cents']);
        $this->assertNull($context['issues']);
        $this->assertNull($context['inspection']);
    }

    #[Test]
    public function releasing_one_hundred_thousand_lowers_cash_on_hand_by_exactly_that_much_and_lists_the_movement(): void
    {
        $ceo = $this->account('ceo');
        $ha = $this->account('head_accountant');
        // The opening balance the Head Accountant set, as app_settings holds it.
        DB::table('app_settings')->insert(['key' => 'finance_opening_cents', 'value' => json_encode(1_000_000), 'updated_at' => now()]);
        $this->assertSame(1_000_000, $this->financePage($ha)['cashOnHand']['total_cents']);

        $this->act($ceo)->postJson('/api/v1/staff/finance/create-disbursement', ['title' => 'Reconditioning fund', 'amount_cents' => 10_000_000, 'purpose' => 'Repair the bought car'])->assertOk();
        $id = DB::table('disbursement_requests')->value('id');
        foreach (['approved', 'released'] as $step) {
            $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => $step])->assertOk();
        }

        $page = $this->financePage($ha);
        $this->assertSame(['opening_cents' => 1_000_000, 'movements_cents' => -10_000_000, 'total_cents' => -9_000_000], $page['cashOnHand']);
        $entry = collect($page['entries'])->firstWhere('entry_kind', 'disbursement');
        $this->assertSame(10_000_000, $entry['amount_cents']);
        $this->assertSame('Funds released: Reconditioning fund. Repair the bought car', $entry['description']);
        $this->assertNotNull($entry['recorded_at']);
    }

    #[Test]
    public function a_confirmed_excess_return_raises_cash_on_hand(): void
    {
        $sale = $this->sellOffer();
        $ms = $this->account('marketing_specialist');
        $ha = $this->account('head_accountant');
        $id = $this->released($sale['tx'], $ms, $ha);
        $this->assertSame(-45_000_000, $this->financePage($ha)['cashOnHand']['total_cents']);

        // The requester brings back ₱20,000 of the car payment, and the Head Accountant confirms receiving it.
        DB::table('disbursement_requests')->where('id', $id)->update(['returned_cents' => 2_000_000, 'returned_at' => now()]);
        $this->assertSame(-45_000_000, $this->financePage($ha)['cashOnHand']['total_cents'], 'an unconfirmed return changes nothing yet');
        $this->act($ha)->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $id])->assertOk();

        $page = $this->financePage($ha);
        $this->assertSame(-43_000_000, $page['cashOnHand']['total_cents']);
        $mine = collect($page['entries'])->firstWhere('entry_kind', 'adjustment');
        $this->assertSame([2_000_000, 'Excess returned: Car purchase fund', $sale['tx']], [$mine['amount_cents'], $mine['description'], $mine['transaction_id']]);
    }

    #[Test]
    public function a_retried_release_does_not_post_a_second_ledger_row(): void
    {
        $ceo = $this->account('ceo');
        $ha = $this->account('head_accountant');
        $this->act($ceo)->postJson('/api/v1/staff/finance/create-disbursement', ['title' => 'Travel advance', 'amount_cents' => 10_000_000, 'purpose' => 'Site visits'])->assertOk();
        $id = DB::table('disbursement_requests')->value('id');
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'approved'])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'released'])->assertOk();
        // The browser retries the release, and a second Head Accountant's click lands too.
        $this->again()->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'released'])->assertStatus(409);
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'released'])->assertStatus(409);

        $this->assertSame(1, DB::table('financial_entries')->where('entry_kind', 'disbursement')->count());
        $this->assertSame(-10_000_000, $this->financePage($ha)['cashOnHand']['total_cents']);
        // A bigger idempotency key is unique too, so an entry can never be double-posted by its source action.
        $this->assertSame(1, DB::table('financial_entries')->where('idempotency_key', 'release:'.$id)->count());
    }

    #[Test]
    public function a_retried_return_confirmation_does_not_post_a_second_adjustment(): void
    {
        $sale = $this->sellOffer();
        $ha = $this->account('head_accountant');
        $id = $this->released($sale['tx'], $this->account('marketing_specialist'), $ha);
        DB::table('disbursement_requests')->where('id', $id)->update(['returned_cents' => 2_000_000, 'returned_at' => now()]);
        $this->act($ha)->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $id])->assertOk();
        $this->again()->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $id])->assertStatus(409);

        $this->assertSame(1, DB::table('financial_entries')->where('entry_kind', 'adjustment')->count());
        $this->assertSame(-43_000_000, $this->financePage($ha)['cashOnHand']['total_cents']);
    }

    #[Test]
    public function a_reimbursed_expense_and_a_verified_buyer_payment_move_cash_once(): void
    {
        $sale = $this->sellOffer();
        $doc = (string) Str::uuid();
        DB::table('transaction_documents')->insert(['id' => $doc, 'transaction_id' => $sale['tx'], 'document_kind' => 'receipt', 'storage_path' => 'x.jpg',
            'uploader_id' => $sale['seller']->id, 'verification_state' => 'verified', 'upload_date' => now()]);
        DB::table('field_case_expenses')->insert(['id' => $expense = (string) Str::uuid(), 'field_case_id' => $sale['case'], 'amount' => '1500.00', 'description' => 'Fuel',
            'proof_document_id' => $doc, 'submitted_by' => $sale['seller']->id, 'submitted_at' => now()]);
        DB::table('vehicles')->where('id', $sale['vehicle'])->update(['listing_state' => 'sold']);
        $ha = $this->account('head_accountant');
        $this->act($ha)->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertOk();
        $this->again()->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertStatus(409);
        $outflow = collect($this->financePage($ha)['entries'])->firstWhere('entry_kind', 'expense');
        $this->assertSame([150_000, 'Field expense reimbursed: Fuel', $sale['tx'], $sale['case']],
            [$outflow['amount_cents'], $outflow['description'], $outflow['transaction_id'], $outflow['field_case_id']]);

        // A verified buyer payment is revenue; asking twice keeps one row.
        $buyer = $this->customer();
        $buyTx = $this->buyRequest($buyer, $this->vehicle(300000, 'reserved'), 'cash', 'gce_visit');
        $this->payment($buyTx, 'full', 300000, null);
        $payment = DB::table('payment_records')->where('transaction_id', $buyTx)->value('id');
        $this->act($ha)->postJson('/api/v1/staff/payments/verify', ['payment_id' => $payment])->assertOk();
        $this->again()->postJson('/api/v1/staff/payments/verify', ['payment_id' => $payment])->assertStatus(409);
        $this->assertSame(1, DB::table('financial_entries')->where('entry_kind', 'revenue')->count());
        $this->assertSame(-150_000 + 30_000_000, $this->financePage($ha)['cashOnHand']['total_cents']);
    }

    #[Test]
    public function the_requester_reads_the_rejection_reason(): void
    {
        $ci = $this->account('confidential_informant');
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle());
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => DB::table('transactions')->where('id', $tx)->value('vehicle_id'),
            'transaction_id' => $tx, 'case_kind' => 'delivery', 'assigned_confidential_informant' => $ci->id, 'state' => 'in_progress',
            'created_at' => now(), 'updated_at' => now()]);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => 2000, 'categories' => ['fuel']])->assertOk();
        $budget = DB::table('disbursement_requests')->where('field_case_id', $case)->value('id');

        // BH-4: a rejection needs no reason to be refused, but the reason typed is what the requester reads.
        $ha = $this->account('head_accountant');
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $budget, 'event_kind' => 'rejected', 'notes' => 'File the trip first'])->assertOk();
        $this->assertSame('File the trip first', DB::table('disbursement_requests')->where('id', $budget)->value('rejection_reason'));

        $mine = $this->financePage($ci)['disbursements'][0];
        $this->assertSame(['rejected', 'File the trip first'], [$mine['status'], $mine['rejection_reason']]);
        // The field case page the requester opens carries it too.
        $budgetRow = $this->act($ci)->getJson('/api/v1/staff/field-cases/'.$case)->assertOk()->json('money.budget');
        $this->assertSame('File the trip first', $budgetRow['rejection_reason']);
        $this->assertSame('Fuel', $budgetRow['purpose']);
    }

    #[Test]
    public function the_head_accountant_reads_the_inspection_but_still_cannot_open_the_inspections_page(): void
    {
        $sale = $this->sellOffer();
        $mechanic = $this->account('mechanic');
        $nodeIds = $this->inspection($sale['case'], $sale['tx'], $mechanic);
        DB::table('field_cases')->where('id', $sale['case'])->update(['inspection_outcome' => 'issue_found', 'mechanic_id' => $mechanic->id]);
        $ha = $this->account('head_accountant');
        $this->released($sale['tx'], $this->account('marketing_specialist'), $ha);

        // SH-3: the fund request carries the packed result, with its parts, status, costs and photos.
        $inspection = $this->financePage($ha)['disbursements'][0]['context']['inspection'];
        $this->assertSame($sale['case'], DB::table('vehicle_inspections')->where('id', $inspection['inspection_id'])->value('field_case_id'));
        $this->assertSame(2, count($inspection['parts']));
        // The result is keyed by part, so the good one and the repaired one are told apart by their node.
        $byNode = collect($inspection['parts'])->keyBy('node_id');
        $this->assertSame(['Cylinder Head', 'good', null], [$byNode[$nodeIds[0]]['name'], $byNode[$nodeIds[0]]['status'], $byNode[$nodeIds[0]]['cost']]);
        $repair = $byNode[$nodeIds[1]];
        $this->assertSame(['Brake pads', 'for_repair'], [$repair['name'], $repair['status']]);
        $this->assertSame(12000.0, (float) $repair['cost']);
        $this->assertTrue($repair['is_hidden_issue']);
        $this->assertSame(12000.0, (float) $inspection['total']);
        $this->assertNotEmpty($repair['photos']);
        $this->assertSame('Both front brakes worn', $inspection['findings']);

        // The narrow grant: the result rides on the fund request, the /inspections page keeps its own roles.
        $this->again()->getJson('/api/v1/staff/inspections')->assertStatus(403);
        $this->again()->getJson('/api/v1/staff/inspections/'.$inspection['inspection_id'])->assertStatus(403);
        $this->act($mechanic)->getJson('/api/v1/staff/inspections')->assertOk();
    }

    /** A two-part inspection on the acquisition case: one good part, one hidden repair with a cost and a photo. */
    private function inspection(string $caseId, string $txId, User $mechanic): array
    {
        $ids = [];
        foreach (['Cylinder Head', 'Brake pads'] as $i => $name) {
            DB::table('inspection_checklist_nodes')->insert(['id' => $ids[] = (string) Str::uuid(), 'parent_id' => null, 'level' => 'part', 'name' => $name, 'display_order' => $i]);
        }
        DB::table('vehicle_inspections')->insert(['id' => $inspection = (string) Str::uuid(), 'vehicle_id' => DB::table('transactions')->where('id', $txId)->value('vehicle_id'),
            'mechanic_id' => $mechanic->id, 'field_case_id' => $caseId, 'inspection_date' => now(), 'findings' => 'Both front brakes worn', 'created_at' => now()]);
        DB::table('inspection_checklist_results')->insert(['id' => (string) Str::uuid(), 'inspection_id' => $inspection, 'checklist_entry_id' => $ids[0],
            'status' => 'good', 'answered_at' => now()]);
        DB::table('inspection_checklist_results')->insert(['id' => (string) Str::uuid(), 'inspection_id' => $inspection, 'checklist_entry_id' => $ids[1],
            'status' => 'for_repair', 'notes' => 'Metal on metal', 'repair_cost' => '12000.00', 'is_hidden_issue' => true, 'answered_at' => now()]);
        DB::table('transaction_documents')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $txId, 'document_kind' => 'inspection_photo',
            'storage_path' => "{$txId}/brakes.jpg", 'note' => $ids[1], 'uploader_id' => $mechanic->id, 'upload_date' => now()]);

        return $ids;
    }
}
