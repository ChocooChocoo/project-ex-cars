<?php

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/** Phase 7: Finance and Sold Inventory page reads, and the T10 field budget (was budget-actions.ts). */
class FinanceReadTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    private function deliveryCase(?string $ciId): array
    {
        $buyer = $this->customer();
        $vehicle = $this->vehicle();
        $tx = $this->buyRequest($buyer, $vehicle);
        DB::table('field_cases')->insert(['id' => $case = (string) Str::uuid(), 'vehicle_id' => $vehicle, 'transaction_id' => $tx, 'case_kind' => 'delivery',
            'assigned_confidential_informant' => $ciId, 'state' => 'in_progress', 'created_at' => now(), 'updated_at' => now()]);

        return ['tx' => $tx, 'case' => $case];
    }

    #[Test]
    public function finance_page_rows_follow_the_old_row_rules(): void
    {
        $ci = $this->account('confidential_informant');
        $other = $this->account('confidential_informant');
        ['case' => $case] = $this->deliveryCase($ci->id);
        ['case' => $otherCase] = $this->deliveryCase($other->id);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => '1500.50', 'purpose' => 'Fuel and tolls'])->assertOk();
        $this->act($other)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $otherCase, 'amount' => 900, 'purpose' => 'Fuel'])->assertOk();
        DB::table('financial_entries')->insert(['id' => (string) Str::uuid(), 'entry_kind' => 'revenue', 'amount_cents' => 100, 'description' => 'x', 'recorded_by' => $ci->id, 'recorded_at' => now(), 'created_at' => now()]);

        $page = $this->act($ci)->getJson('/api/v1/staff/finance')->assertOk();
        $this->assertSame([], $page->json('entries'), 'the informant does not read the ledger');
        $this->assertCount(1, $page->json('disbursements'), 'only their own requests');
        $this->assertSame(150050, $page->json('disbursements.0.amount_cents'));
        $this->assertSame([], $page->json('saleRecords'));

        $ha = $this->act($this->account('head_accountant'))->getJson('/api/v1/staff/finance')->assertOk();
        $this->assertCount(1, $ha->json('entries'));
        $this->assertCount(2, $ha->json('disbursements'));
        $this->act($this->account('mechanic'))->getJson('/api/v1/staff/finance')->assertStatus(403);
        $this->act($this->account('account_manager'))->getJson('/api/v1/staff/financing')->assertStatus(403);
        $this->act($this->account('ceo'))->getJson('/api/v1/staff/financing')->assertOk()->assertJsonPath('canRequest', false);
    }

    #[Test]
    public function field_budget_request_return_and_confirmation(): void
    {
        $ci = $this->account('confidential_informant');
        ['case' => $case, 'tx' => $tx] = $this->deliveryCase($ci->id);
        $this->act($this->account('confidential_informant'))->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => 100, 'purpose' => 'x'])
            ->assertStatus(403);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => 0, 'purpose' => 'x'])->assertStatus(422)
            ->assertJsonPath('message', 'Enter the estimated expenses.');
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => 2000, 'purpose' => 'Fuel'])->assertOk();
        $this->act($ci)->postJson('/api/v1/staff/field-budget/request', ['field_case_id' => $case, 'amount' => 2000, 'purpose' => 'Fuel'])->assertStatus(409)
            ->assertJsonPath('message', 'This field case already has a budget request.');
        $this->assertSame('The Confidential Informant requests ₱2,000.00 for estimated expenses. Review it in Finance.',
            DB::table('notifications')->where('kind', 'field_budget_requested')->where('reference_id', $tx)->value('body'));

        $this->act($ci)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case, 'returned' => 100])->assertStatus(409)
            ->assertJsonPath('message', 'The Head Accountant has not released a budget yet.');
        $budget = DB::table('disbursement_requests')->where('field_case_id', $case)->value('id');
        DB::table('disbursement_requests')->where('id', $budget)->update(['status' => 'released']);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case, 'returned' => 2000.01])->assertStatus(422);
        $this->act($ci)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case, 'returned' => 350])->assertOk();
        $this->act($ci)->postJson('/api/v1/staff/field-budget/return', ['field_case_id' => $case, 'returned' => 350])->assertStatus(409);
        $this->assertSame(35000, (int) DB::table('disbursement_requests')->where('id', $budget)->value('returned_cents'));

        $this->act($this->account('ceo'))->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $budget])->assertStatus(403);
        $ha = $this->account('head_accountant');
        $this->act($ha)->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $budget])->assertOk();
        $this->act($ha)->postJson('/api/v1/staff/field-budget/confirm-return', ['disbursement_id' => $budget])->assertStatus(409);
    }
}
