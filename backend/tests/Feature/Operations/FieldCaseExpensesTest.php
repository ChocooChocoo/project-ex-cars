<?php

namespace Tests\Feature\Operations;

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
 * Plan Phase 7 (SN-5, SN-6, SN-7, SN-8, SH-9, BH-2, BH-5, BH-3 / SN-2 / SH-11): field case states, the expense
 * total taken from the filed rows, the zero-expense confirmation, CI-only expense filing, the Mechanic's lost
 * contract controls, the budget category checklist and the zero-excess return.
 */
class FieldCaseExpensesTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Storage::fake('public');
    }

    /**
     * An approved sell offer with its acquisition field case, its CI and Mechanic. `$meetup` is the seller's
     * arrangement: `gce_visit` (no travel) or `meet_halfway` (a trip that must report its expenses).
     */
    private function acquisitionCase(string $meetup = 'meet_halfway', array $case = []): array
    {
        $seller = $this->customer();
        $ci = $this->account('confidential_informant');
        $mechanic = $this->account('mechanic');
        $vehicle = $this->vehicle(450000, 'draft');
        $tx = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell',
            'vehicle_id' => $vehicle, 'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert(['id' => (string) Str::uuid(), 'transaction_id' => $tx, 'offered_amount' => 500000,
            'agreed_price' => '450000.00', 'meetup_method' => $meetup, 'created_at' => now(), 'updated_at' => now()]);
        DB::table('field_cases')->insert($case + ['id' => $id = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx,
            'case_kind' => 'acquisition', 'assigned_confidential_informant' => $ci->id, 'mechanic_id' => $mechanic->id,
            'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'vehicle' => $vehicle, 'case' => $id, 'ci' => $ci, 'mechanic' => $mechanic, 'seller' => $seller];
    }

    /** A delivery case with its released budget, so the return path can be exercised. */
    private function releasedBudget(User $ci, float $amount): array
    {
        $buyer = $this->customer();
        $vehicle = $this->vehicle();
        $tx = $this->buyRequest($buyer, $vehicle);
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx,
            'case_kind' => 'delivery', 'assigned_confidential_informant' => $ci->id, 'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => $amount, 'categories' => ['fuel']])->assertOk();
        $budget = DB::table('disbursement_requests')->where('field_case_id', $case)->value('id');
        DB::table('disbursement_requests')->where('id', $budget)->update(['status' => 'released']);

        return ['case' => $case, 'budget' => $budget, 'tx' => $tx];
    }

    private function fileExpense(User $ci, string $caseId, string $amount = '350.00', string $description = 'Fuel'): void
    {
        $this->act($ci)->post('/api/v1/staff/field/file-field-expense', [
            'field_case_id' => $caseId, 'amount' => $amount, 'description' => $description,
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertOk();
    }

    #[Test]
    public function a_gce_visit_acquisition_case_completes_with_no_expense_rows(): void
    {
        $setup = $this->acquisitionCase('gce_visit');

        // SN-8: a GCE visit has no travel, so the guard does not apply and nothing needs filing first.
        $this->act($setup['ci'])->postJson('/api/v1/staff/field/update-field-case', [
            'field_case_id' => $setup['case'], 'state' => 'completed',
        ])->assertOk();

        $case = DB::table('field_cases')->where('id', $setup['case'])->first();
        $this->assertSame('completed', $case->state);
        $this->assertNotNull($case->completion_date);
        $this->assertSame(0, DB::table('field_case_expenses')->where('field_case_id', $setup['case'])->count());
        $this->assertSame(0, (int) $case->expenses_cents);
        $this->assertNull($case->no_expenses_at, 'a GCE visit needs no "no expenses" answer');
    }

    #[Test]
    public function a_halfway_acquisition_case_needs_expenses_or_the_no_expenses_confirmation(): void
    {
        $setup = $this->acquisitionCase('meet_halfway');
        $url = '/api/v1/staff/field/update-field-case';
        $base = ['field_case_id' => $setup['case']];

        // SN-8: the guard bites only on a halfway seller meet-up with nothing filed.
        $this->act($setup['ci'])->postJson($url, $base + ['state' => 'completed'])->assertStatus(422)
            ->assertJsonPath('message', 'File the meet-up expenses with proofs before completing this case.');
        $this->assertNotSame('completed', DB::table('field_cases')->where('id', $setup['case'])->value('state'));

        // The explicit "No expenses for this trip" answer satisfies it and leaves a marker, not a fake expense row.
        $this->again()->postJson($url, $base + ['no_expenses' => true])->assertOk();
        $this->assertNotNull(DB::table('field_cases')->where('id', $setup['case'])->value('no_expenses_at'));
        $this->assertSame(0, DB::table('field_case_expenses')->where('field_case_id', $setup['case'])->count());
        $this->again()->postJson($url, $base + ['state' => 'completed'])->assertOk();
        $this->assertSame('completed', DB::table('field_cases')->where('id', $setup['case'])->value('state'));

        // Filing an expense afterwards is refused: the trip was already recorded as costing nothing.
        $this->fileExpenseFor($setup, '400.00', expectStatus: 409);
    }

    #[Test]
    public function the_case_total_is_the_sum_of_the_filed_expenses(): void
    {
        $setup = $this->acquisitionCase('meet_halfway');
        $this->fileExpense($setup['ci'], $setup['case'], '350.50', 'Fuel');
        $this->fileExpense($setup['ci'], $setup['case'], '120.00', 'Tolls');

        // SN-6: two rows add up in centavos, exactly, on the case row itself.
        $this->assertSame(47050, (int) DB::table('field_cases')->where('id', $setup['case'])->value('expenses_cents'));

        // A state update rewrites the computed total; the client cannot send its own.
        $this->act($setup['ci'])->postJson('/api/v1/staff/field/update-field-case', [
            'field_case_id' => $setup['case'], 'state' => 'in_progress', 'expenses_cents' => 999999,
        ])->assertOk();
        $this->assertSame(47050, (int) DB::table('field_cases')->where('id', $setup['case'])->value('expenses_cents'),
            'expenses_cents from the browser is ignored');

        // The case page ships the itemised rows with their signed proofs, so the card can show the same total.
        $pack = $this->act($setup['ci'])->getJson("/api/v1/staff/field-cases/{$setup['case']}")->assertOk();
        $this->assertCount(2, $pack->json('expenses'));
        $this->act($setup['ci'])->postJson('/api/v1/staff/field/update-field-case', [
            'field_case_id' => $setup['case'], 'state' => 'completed',
        ])->assertOk();
        $this->assertSame('completed', DB::table('field_cases')->where('id', $setup['case'])->value('state'));
    }

    #[Test]
    public function a_mechanic_cannot_file_a_meet_up_expense_but_reads_the_ci_expenses(): void
    {
        $setup = $this->acquisitionCase('meet_halfway');
        $url = '/api/v1/staff/field/file-field-expense';

        // SH-9: the expense (and its proof money trail) belongs to the Confidential Informant.
        $this->act($setup['mechanic'])->post($url, [
            'field_case_id' => $setup['case'], 'amount' => '500', 'description' => 'Fuel',
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertForbidden()->assertJsonPath('message', 'Only the Confidential Informant files meet-up expenses.');
        $this->assertSame(0, DB::table('field_case_expenses')->where('field_case_id', $setup['case'])->count());
        $this->assertSame(0, DB::table('transaction_documents')->where('document_kind', 'expense_proof')->count());

        $this->fileExpense($setup['ci'], $setup['case'], '500.00', 'Fuel');

        // The Mechanic reads the filed row through the case pack, without a filing control of their own.
        $pack = $this->act($setup['mechanic'])->getJson("/api/v1/staff/field-cases/{$setup['case']}")->assertOk();
        $this->assertSame('Fuel', $pack->json('expenses.0.description'));
        $this->assertSame(500, $pack->json('expenses.0.amount'));

        // Fund requests stay CI only too.
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle());
        DB::table('field_cases')->insert(['id' => $delivery = (string) Str::uuid(), 'transaction_id' => $tx, 'case_kind' => 'delivery',
            'assigned_confidential_informant' => $setup['ci']->id, 'mechanic_id' => $setup['mechanic']->id, 'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);
        $this->act($setup['mechanic'])->postJson('/api/v1/staff/field-budget/request', [
            'field_case_id' => $delivery, 'amount' => 900, 'categories' => ['fuel'],
        ])->assertForbidden();
        $this->act($setup['ci'])->postJson('/api/v1/staff/field-budget/request', [
            'field_case_id' => $delivery, 'amount' => 900, 'categories' => ['fuel'],
        ])->assertOk();
    }

    #[Test]
    public function a_field_worker_is_offered_only_in_progress_completed_and_cancelled(): void
    {
        $setup = $this->acquisitionCase('gce_visit');
        $url = '/api/v1/staff/field/update-field-case';
        $base = ['field_case_id' => $setup['case']];

        // SN-5: Assigned comes from creation and Accepted is stamped on the first update — never picked by a worker.
        $this->act($setup['ci'])->postJson($url, $base + ['state' => 'assigned'])->assertStatus(422)
            ->assertJsonPath('message', 'A field worker can only set In progress, Completed or Cancelled.');
        $this->again()->postJson($url, $base + ['state' => 'accepted'])->assertStatus(422);
        $this->assertSame('in_progress', DB::table('field_cases')->where('id', $setup['case'])->value('state'));
        $this->assertSame(['in_progress', 'completed', 'cancelled'], \App\Http\Controllers\Field\FieldCaseActionController::WORKER_STATES);

        // The first update accepts the case on the worker's behalf.
        $this->assertNull(DB::table('field_cases')->where('id', $setup['case'])->value('accepted_at'));
        $this->again()->postJson($url, $base + ['state' => 'in_progress'])->assertOk();
        $this->assertNotNull(DB::table('field_cases')->where('id', $setup['case'])->value('accepted_at'));
        $this->again()->postJson($url, $base + ['state' => 'cancelled'])->assertOk();
        $this->assertSame('cancelled', DB::table('field_cases')->where('id', $setup['case'])->value('state'));

        // An overseer keeps the full list (they create and reset cases).
        $setup2 = $this->acquisitionCase('gce_visit');
        $this->act($this->account('ceo'))->postJson($url, ['field_case_id' => $setup2['case'], 'state' => 'accepted'])->assertOk();
    }

    #[Test]
    public function a_zero_excess_return_is_confirmed_on_the_spot_and_notifies_no_one(): void
    {
        $ci = $this->account('confidential_informant');
        ['case' => $case, 'budget' => $budget, 'tx' => $tx] = $this->releasedBudget($ci, 2000);

        // BH-3 / SN-2 / SH-11: zero is a real answer, so it needs no Head Accountant confirmation task.
        $this->act($ci)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case, 'returned' => 0])->assertOk();

        $row = DB::table('disbursement_requests')->where('id', $budget)->first();
        $this->assertSame([0, null], [(int) $row->returned_cents, $row->return_confirmed_by], 'system-confirmed, no person');
        $this->assertNotNull($row->returned_at);
        $this->assertNotNull($row->return_confirmed_at);
        $this->assertSame($row->returned_at, $row->return_confirmed_at, 'confirmed at the moment it was recorded');
        $this->assertSame(0, DB::table('notifications')->where('kind', 'field_budget_returned')->count());
        $this->assertSame(0, DB::table('notifications')->where('reference_id', $tx)->where('kind', 'field_budget_returned')->count());

        // The Head Accountant has nothing to confirm, so the confirm endpoint reports there is no open return.
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $budget])->assertStatus(409);

        // A positive excess still waits for the Head Accountant.
        $ci2 = $this->account('confidential_informant');
        ['case' => $case2, 'budget' => $budget2, 'tx' => $tx2] = $this->releasedBudget($ci2, 2000);
        $this->act($ci2)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case2, 'returned' => 350])->assertOk();
        $returned = DB::table('disbursement_requests')->where('id', $budget2)->first();
        $this->assertSame([35000, null], [(int) $returned->returned_cents, $returned->return_confirmed_at]);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'field_budget_returned')->where('reference_id', $tx2)->count());
    }

    #[Test]
    public function the_budget_request_stores_the_joined_category_labels(): void
    {
        $ci = $this->account('confidential_informant');
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle());
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'transaction_id' => $tx, 'case_kind' => 'delivery',
            'assigned_confidential_informant' => $ci->id, 'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);
        $url = '/api/v1/staff/field-budget/request';

        // BH-5: a free-text purpose alone is no longer accepted, and an unknown category is refused.
        $this->act($ci)->postJson($url, ['field_case_id' => $case, 'amount' => 2000, 'purpose' => 'Fuel'])->assertStatus(422)
            ->assertJsonPath('message', 'Say what the budget covers.');
        $this->again()->postJson($url, ['field_case_id' => $case, 'amount' => 2000, 'categories' => ['bribes']])->assertStatus(422);
        $this->again()->postJson($url, ['field_case_id' => $case, 'amount' => 2000, 'categories' => ['other']])->assertStatus(422)
            ->assertJsonPath('message', 'Say what the other expense is.');

        // The stored purpose is the labels in checklist order, with the typed "Other" appended, so finance reads it.
        $this->again()->postJson($url, ['field_case_id' => $case, 'amount' => '2000.50', 'categories' => ['meals', 'fuel', 'tolls', 'other'], 'other' => 'Car wash'])
            ->assertOk();
        $budget = DB::table('disbursement_requests')->where('field_case_id', $case)->first();
        $this->assertSame('Fuel, Tolls, Meals, Other: Car wash', $budget->purpose);
        $this->assertSame(200050, (int) $budget->amount_cents);
        $this->assertSame($budget->purpose, \App\Http\Controllers\Finance\FieldBudgetController::purposeFromCategories(['meals', 'fuel', 'tolls', 'other'], 'Car wash'));
    }

    #[Test]
    public function the_mechanic_keeps_no_contract_copy_on_a_buyer_meetup(): void
    {
        // BH-2: only the Confidential Informant is waited on for a signed copy, for every field arrangement.
        $meetup = (object) ['arrangement_kind' => 'meetup', 'payment_method' => 'cash'];
        $delivery = (object) ['arrangement_kind' => 'delivery', 'payment_method' => 'cash'];
        $visit = (object) ['arrangement_kind' => 'gce_visit', 'payment_method' => 'cash'];

        $this->assertSame(['Confidential Informant'], \App\Services\Trading\BuyRules::missingContractCopies($meetup, null));
        $this->assertSame(['Confidential Informant'], \App\Services\Trading\BuyRules::missingContractCopies($delivery, null));
        $this->assertSame([], \App\Services\Trading\BuyRules::missingContractCopies($visit, null));
        $this->assertSame([], \App\Services\Trading\BuyRules::missingContractCopies($meetup, (object) ['ci_copy_at' => now()]));
    }

    /** `fileExpense` for a case setup array, with the expected status, to keep the assertions readable. */
    private function fileExpenseFor(array $setup, string $amount, int $expectStatus): void
    {
        $this->act($setup['ci'])->post('/api/v1/staff/field/file-field-expense', [
            'field_case_id' => $setup['case'], 'amount' => $amount, 'description' => 'Fuel',
            'proof' => UploadedFile::fake()->image('receipt.jpg'),
        ])->assertStatus($expectStatus);
    }
}
