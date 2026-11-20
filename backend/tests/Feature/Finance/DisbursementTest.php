<?php

namespace Tests\Feature\Finance;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/**
 * Phase 6: car-purchase funds, the seller payment and its routing (the complete_purchase_disbursement SQL function,
 * latest version 20261116140000), the release chain, reconditioning funds and expense reimbursement.
 */
class DisbursementTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
    }

    /** An approved sell offer with an agreed price, its acquisition field case and the bought car (draft). */
    private function sellOffer(string $meetup = 'gce_visit', ?User $ci = null, ?User $mechanic = null, array $sell = []): array
    {
        $seller = $this->customer();
        $vehicle = $this->vehicle(450000, 'draft');
        $tx = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell', 'vehicle_id' => $vehicle,
            'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert($sell + ['id' => (string) Str::uuid(), 'transaction_id' => $tx, 'agreed_price' => '450000.00', 'meetup_method' => $meetup]);
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx, 'case_kind' => 'acquisition',
            'assigned_confidential_informant' => $ci?->id, 'mechanic_id' => $mechanic?->id, 'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'vehicle' => $vehicle, 'case' => $case];
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

    #[Test]
    public function the_requester_pays_the_seller_once_the_car_is_cleared_and_a_clean_car_goes_to_posting(): void
    {
        $sale = $this->sellOffer();
        $ms = $this->account('marketing_specialist');
        $ha = $this->account('head_accountant');
        $id = $this->released($sale['tx'], $ms, $ha);
        $request = DB::table('disbursement_requests')->where('id', $id)->first();
        $this->assertSame([45_000_000, 'released', 'Car payment ₱450,000 (GCE Visit)'], [(int) $request->amount_cents, $request->status, $request->purpose]);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'purchase_funds_requested')->count());
        $this->act($ms)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $sale['tx']])->assertStatus(409)->assertJson(['message' => 'The funds for this car are already requested.']);

        $this->act($ms)->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $id])->assertStatus(422)->assertJson(['message' => 'The car is not cleared for payment yet.']);
        $this->act($this->account('marketing_specialist'))->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $id])->assertForbidden();

        DB::table('sell_details')->where('transaction_id', $sale['tx'])->update(['cleared_for_payment_at' => now()]);
        $this->act($ms)->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $id])->assertOk();
        $this->assertSame('paid', DB::table('disbursement_requests')->where('id', $id)->value('status'));
        $this->assertSame('completed', DB::table('transactions')->where('id', $sale['tx'])->value('current_state'));
        $this->assertSame('awaiting_price_approval', DB::table('vehicles')->where('id', $sale['vehicle'])->value('listing_state'));
        $this->assertSame('GCE paid ₱450000.00 for a seller\'s car.', DB::table('notifications')->where('kind', 'sell_payment_disbursed')->value('body'));

        // A repeat (requester or Head Accountant) pays nothing twice and reopens nothing.
        $this->again()->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $id])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'paid'])->assertOk();
        $this->assertSame(1, DB::table('disbursement_events')->where('disbursement_id', $id)->where('event_kind', 'paid')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'sell_payment_disbursed')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'sell_vehicle_ready_to_post')->count());
        // BH-3: one "Car fully paid" record for the Head Accountant, with the agreed price.
        $paid = DB::table('notifications')->where('kind', 'sell_car_fully_paid')->get();
        $this->assertCount(1, $paid);
        $this->assertSame('head_accountant', $paid[0]->recipient_role);
        $this->assertStringContainsString('for ₱450,000.00. Status: seller paid in full.', $paid[0]->body);
        $this->assertSame(1, DB::table('transaction_status_history')->where('transaction_id', $sale['tx'])->where('to_state', 'completed')->count());
    }

    #[Test]
    public function a_car_with_an_inspection_or_declared_issue_goes_to_reconditioning(): void
    {
        $ha = $this->account('head_accountant');
        $mechanic = $this->account('mechanic');
        foreach ([['inspection_outcome' => 'issue_found'], ['has_known_issues' => true]] as $i => $issue) {
            $sale = $this->sellOffer('gce_visit', null, $mechanic, isset($issue['has_known_issues']) ? $issue : []);
            if (isset($issue['inspection_outcome'])) {
                DB::table('field_cases')->where('id', $sale['case'])->update($issue);
            }
            $id = $this->released($sale['tx'], $this->account('marketing_specialist'), $ha);
            DB::table('sell_details')->where('transaction_id', $sale['tx'])->update(['cleared_for_payment_at' => now()]);
            // The Head Accountant can record it too.
            $this->act($ha)->postJson('/api/v1/staff/finance/record-seller-paid', ['disbursement_id' => $id])->assertOk();
            $this->assertSame('repairing', DB::table('vehicles')->where('id', $sale['vehicle'])->value('listing_state'), "case {$i}");
            $job = DB::table('reconditioning_jobs')->where('vehicle_id', $sale['vehicle'])->first();
            $this->assertSame([$mechanic->id, 'awaiting_report'], [$job->mechanic_id, $job->state]);
            $this->assertSame(1, DB::table('notifications')->where('kind', 'reconditioning')->where('recipient_id', $mechanic->id)->where('reference_id', $sale['vehicle'])->count());
        }
    }

    #[Test]
    public function on_a_meet_halfway_only_the_assigned_informant_requests_price_plus_travel(): void
    {
        $ci = $this->account('confidential_informant');
        $sale = $this->sellOffer('meet_halfway', $ci);
        $this->act($this->account('marketing_specialist'))->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $sale['tx']])
            ->assertForbidden()->assertJson(['message' => 'On a Meet Halfway, the assigned Confidential Informant requests the funds.']);
        $this->act($this->account('confidential_informant'))->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $sale['tx'], 'travel_cents' => 150_000])->assertForbidden();
        $this->act($ci)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $sale['tx'], 'travel_cents' => 150_000])->assertOk();
        $request = DB::table('disbursement_requests')->where('purchase_transaction_id', $sale['tx'])->first();
        $this->assertSame([45_150_000, 'Car payment ₱450,000 plus estimated travel ₱1,500 (Meet Halfway)'], [(int) $request->amount_cents, $request->purpose]);
    }

    #[Test]
    public function the_release_chain_moves_one_step_at_a_time_and_car_funds_need_the_head_accountant(): void
    {
        $am = $this->account('account_manager');
        $ceo = $this->account('ceo');
        $this->act($am)->postJson('/api/v1/staff/finance/create-disbursement', ['title' => 'Office supplies', 'amount_cents' => 0, 'purpose' => 'x'])->assertStatus(422);
        $this->again()->postJson('/api/v1/staff/finance/create-disbursement', ['title' => 'Office supplies', 'amount_cents' => 125_050, 'purpose' => 'Paper'])->assertOk();
        $id = DB::table('disbursement_requests')->value('id');
        $step = fn (string $kind) => $this->act($ceo)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => $kind]);
        $step('released')->assertStatus(409)->assertJson(['message' => 'Cannot move from draft to released.']);
        $step('approved')->assertOk();
        $step('rejected')->assertStatus(409)->assertJson(['message' => 'Only draft or submitted requests can be rejected.']);
        $step('released')->assertOk();
        $step('received')->assertOk();
        $step('paid')->assertOk();
        $this->assertEqualsCanonicalizing(['submitted', 'approved', 'released', 'received', 'paid'], DB::table('disbursement_events')->where('disbursement_id', $id)->pluck('event_kind')->all());
        $this->act($am)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'paid'])->assertForbidden();

        // Car-purchase funds: the CEO cannot release them, only the Head Accountant.
        $buy = $this->buyRequest($this->customer(), $this->vehicle(), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $this->act($am)->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $buy])->assertStatus(422)->assertJson(['message' => 'Enter the amount.']);
        $this->again()->postJson('/api/v1/staff/finance/request-purchase-funds', ['transaction_id' => $buy, 'amount_cents' => 1_000_000])->assertOk();
        $car = DB::table('disbursement_requests')->where('purchase_transaction_id', $buy)->value('id');
        $this->act($ceo)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $car, 'event_kind' => 'approved'])->assertForbidden()
            ->assertJson(['message' => 'Only the Head Accountant can approve or release car-purchase funds.']);
    }

    #[Test]
    public function approve_and_release_is_one_click_and_a_retry_moves_no_more_cash(): void
    {
        $ceo = $this->account('ceo');
        $this->act($ceo)->postJson('/api/v1/staff/finance/create-disbursement', ['title' => 'Tyres', 'amount_cents' => 200_000, 'purpose' => 'Stock'])->assertOk();
        $id = DB::table('disbursement_requests')->value('id');
        $revenueBefore = DB::table('financial_entries')->where('entry_kind', 'revenue')->sum('amount_cents');

        $this->again()->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'approve_release'])->assertOk();
        $this->again()->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $id, 'event_kind' => 'approve_release'])->assertOk();

        $row = DB::table('disbursement_requests')->where('id', $id)->first();
        $this->assertSame('released', $row->status);
        $this->assertSame($ceo->id, $row->approved_by);
        $this->assertSame($ceo->id, $row->released_by);
        $this->assertSame(1, DB::table('financial_entries')->where('idempotency_key', 'release:'.$id)->count());
        // Notes line 191: a release is an outflow, not a lower revenue.
        $this->assertEquals($revenueBefore, DB::table('financial_entries')->where('entry_kind', 'revenue')->sum('amount_cents'));
        $this->assertSame('disbursement', DB::table('financial_entries')->where('idempotency_key', 'release:'.$id)->value('entry_kind'));
    }

    #[Test]
    public function financial_entries_are_recorded_in_centavos_and_verified_once(): void
    {
        $ha = $this->account('head_accountant');
        $this->act($this->account('mechanic'))->postJson('/api/v1/staff/finance/record-entry', ['entry_kind' => 'expense', 'amount_cents' => 100, 'description' => 'x'])->assertForbidden();
        $this->act($this->account('account_manager'))->postJson('/api/v1/staff/finance/record-entry', ['entry_kind' => 'expense', 'amount_cents' => -1, 'description' => 'x'])
            ->assertStatus(422)->assertJson(['message' => 'Amount cannot be negative.']);
        $this->again()->postJson('/api/v1/staff/finance/record-entry', ['entry_kind' => 'revenue', 'amount_cents' => 4_999_950, 'description' => 'Sale'])->assertOk();
        $entry = DB::table('financial_entries')->first();
        $this->assertSame(4_999_950, (int) $entry->amount_cents);
        $this->act($ha)->postJson('/api/v1/staff/finance/verify-entry', ['entry_id' => $entry->id])->assertOk();
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/finance/verify-entry', ['entry_id' => $entry->id])->assertOk();
        $this->assertSame($ha->id, DB::table('financial_entries')->where('id', $entry->id)->value('verified_by'), 'the first verifier stays');
    }

    #[Test]
    public function expenses_are_reimbursed_once_after_the_car_is_sold(): void
    {
        $sale = $this->sellOffer();
        $doc = (string) Str::uuid();
        DB::table('transaction_documents')->insert(['id' => $doc, 'transaction_id' => $sale['tx'], 'document_kind' => 'receipt', 'storage_path' => 'x.jpg',
            'uploader_id' => DB::table('users')->value('id'), 'verification_state' => 'verified', 'upload_date' => now()]);
        DB::table('field_case_expenses')->insert(['id' => $expense = (string) Str::uuid(), 'field_case_id' => $sale['case'], 'amount' => '1500.00', 'description' => 'Fuel',
            'proof_document_id' => $doc, 'submitted_by' => DB::table('users')->value('id'), 'submitted_at' => now()]);
        $ha = $this->account('head_accountant');
        $this->act($this->account('ceo'))->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertForbidden();
        $this->act($ha)->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertStatus(422)->assertJson(['message' => 'Reimburse only after the vehicle is sold.']);
        DB::table('vehicles')->where('id', $sale['vehicle'])->update(['listing_state' => 'sold']);
        $this->again()->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertOk();
        $this->again()->postJson('/api/v1/staff/finance/mark-expense-reimbursed', ['expense_id' => $expense])->assertStatus(409)->assertJson(['message' => 'This expense is already reimbursed.']);
    }

    #[Test]
    public function reconditioning_shortfalls_need_receipts_and_the_leftover_is_returned_once(): void
    {
        $mechanic = $this->account('mechanic');
        $vehicle = $this->vehicle(400000, 'repairing');
        DB::table('reconditioning_jobs')->insert(['id' => $job = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'mechanic_id' => $mechanic->id, 'state' => 'in_progress', 'created_at' => now()]);
        $receipt = fn () => UploadedFile::fake()->image('r.jpg');

        $this->act($mechanic)->post('/api/v1/staff/reconditioning/request-funds', ['job_id' => $job, 'amount' => '2500.50', 'shortfall_reason' => 'Brake pads cost more than quoted'])
            ->assertStatus(422)->assertJson(['message' => 'Attach at least one receipt photo.']);
        $this->act($this->account('mechanic'))->post('/api/v1/staff/reconditioning/request-funds', ['job_id' => $job, 'amount' => '2500.50', 'shortfall_reason' => 'Brake pads cost more than quoted', 'receipts' => $receipt()])
            ->assertForbidden(); // one photo, sent as a single file
        $this->act($mechanic)->post('/api/v1/staff/reconditioning/request-funds', ['job_id' => $job, 'amount' => '2500.50', 'shortfall_reason' => 'Brake pads cost more than quoted', 'receipts' => [$receipt(), $receipt()]])
            ->assertOk();
        $fund = DB::table('reconditioning_fund_requests')->where('job_id', $job)->first();
        $this->assertSame([250_050, 'submitted'], [(int) $fund->amount_cents, $fund->state]);
        $this->assertSame(2, DB::table('reconditioning_fund_receipts')->where('fund_request_id', $fund->id)->count());
        $this->assertSame(250_050, (int) DB::table('disbursement_requests')->where('id', $fund->disbursement_id)->value('amount_cents'));

        // Releasing the request moves the fund ledger with it.
        $ha = $this->account('head_accountant');
        foreach (['approved', 'released'] as $step) {
            $this->act($ha)->postJson('/api/v1/staff/finance/advance', ['disbursement_id' => $fund->disbursement_id, 'event_kind' => $step])->assertOk();
        }
        $this->assertSame('released', DB::table('reconditioning_fund_requests')->where('id', $fund->id)->value('state'));

        DB::table('reconditioning_jobs')->where('id', $job)->update(['state' => 'completed', 'refund_due_cents' => 30_000]);
        $this->act($mechanic)->postJson('/api/v1/staff/reconditioning/refund-returned', ['job_id' => $job])->assertOk();
        $this->again()->postJson('/api/v1/staff/reconditioning/refund-returned', ['job_id' => $job])->assertStatus(409)->assertJson(['message' => 'The leftover is already marked returned.']);
        $this->assertSame(1, DB::table('notifications')->where('title', 'Reconditioning refund returned')->count());
    }
}
