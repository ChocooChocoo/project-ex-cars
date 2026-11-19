<?php

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/** Phase 6: financing terms and the agreement (was financing-actions.test.ts), against Laravel. */
class FinancingTermsTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    private function request(string $arrangement = 'gce_visit', array $tx = []): string
    {
        $id = $this->buyRequest($this->customer(), $this->vehicle(500000), 'financing', $arrangement, null, $tx + ['current_state' => 'approved']);

        return $id;
    }

    private function terms(string $tx, string $state, array $extra = []): string
    {
        DB::table('payment_terms')->insert($extra + ['id' => $id = (string) Str::uuid(), 'purchase_transaction_id' => $tx, 'arrangement_description' => '12-month In-House Financing',
            'agreed_by' => DB::table('users')->value('id'), 'total_amount' => '550000.00', 'down_payment' => '50000.00', 'monthly_payment' => '41667.00', 'number_of_payments' => 12,
            'duration_months' => 12, 'payment_frequency' => 'monthly', 'first_due_date' => '2033-02-01', 'state' => $state]);

        return $id;
    }

    private function propose(string $tx, array $form = []): \Illuminate\Testing\TestResponse
    {
        return $this->act($this->account('sales_manager'))->postJson('/api/v1/staff/financing/propose', $form + ['transaction_id' => $tx, 'first_due_date' => '2033-02-01']);
    }

    #[Test]
    public function the_sales_manager_proposes_terms_worked_out_by_the_server(): void
    {
        $tx = $this->request();
        // A typed total wins; the downpayment is always 10% of the price and the monthly payment follows the buyer's term.
        $this->propose($tx, ['total_amount' => 600000, 'down_payment' => 1, 'monthly_payment' => 1, 'duration_months' => 60])->assertOk();
        $t = DB::table('payment_terms')->where('purchase_transaction_id', $tx)->first();
        $this->assertSame(['600000.00', '50000.00', '45834.00', 12, 'proposed'], [$t->total_amount, $t->down_payment, $t->monthly_payment, (int) $t->number_of_payments, $t->state]);
        $this->assertSame(1, DB::table('notifications')->where('kind', 'financing_terms_proposed')->where('recipient_role', 'ceo')->count());
        $this->assertSame(0, DB::table('notifications')->where('recipient_role', 'head_accountant')->count(), 'T11: the CEO confirms, not the Head Accountant');
        $this->propose($tx)->assertStatus(409)->assertJson(['message' => 'Terms are already in review.']);

        // Left blank, the total is the price plus the markup: the car's own markup, else the global 10%.
        $blank = $this->request();
        $this->propose($blank)->assertOk();
        $this->assertSame('550000.00', DB::table('payment_terms')->where('purchase_transaction_id', $blank)->value('total_amount'));
        $own = $this->request();
        DB::table('vehicles')->where('id', DB::table('transactions')->where('id', $own)->value('vehicle_id'))->update(['financing_markup_pct' => 12.5]);
        $this->propose($own)->assertOk();
        $this->assertSame('562500.00', DB::table('payment_terms')->where('purchase_transaction_id', $own)->value('total_amount'));

        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/financing/propose', ['transaction_id' => $tx, 'first_due_date' => '2033-02-01'])->assertForbidden();
    }

    #[Test]
    public function proposals_follow_the_arrangement_and_the_buyers_term(): void
    {
        $meetup = $this->request('meetup');
        $this->propose($meetup)->assertOk();
        $this->assertSame('0.00', DB::table('payment_terms')->where('purchase_transaction_id', $meetup)->value('down_payment'), 'a meet-up takes no downpayment');

        $delivery = $this->request('delivery');
        $this->propose($delivery)->assertStatus(422)->assertJson(['message' => 'Enter the delivery fee.']);
        $this->propose($delivery, ['delivery_fee' => 2500])->assertOk();
        $this->assertSame('2500.00', DB::table('payment_terms')->where('purchase_transaction_id', $delivery)->value('delivery_fee'));

        $noTerm = $this->request();
        DB::table('purchase_details')->where('transaction_id', $noTerm)->update(['requested_term_months' => null]);
        $this->propose($noTerm)->assertStatus(422)->assertJson(['message' => 'The buyer has not chosen a payment term yet.']);

        $noPrice = $this->request();
        DB::table('purchase_details')->where('transaction_id', $noPrice)->update(['final_price' => null]);
        $this->propose($noPrice, ['total_amount' => 500000])->assertStatus(422)->assertJson(['message' => 'Set the vehicle price first.']);

        $returned = $this->request();
        $this->terms($returned, 'returned', ['returned_reason' => 'fix it']);
        $this->propose($returned)->assertOk();
        $this->assertSame([null, 'proposed'], [DB::table('payment_terms')->where('purchase_transaction_id', $returned)->value('returned_reason'), DB::table('payment_terms')->where('purchase_transaction_id', $returned)->value('state')]);
        $this->assertSame(1, DB::table('payment_terms')->where('purchase_transaction_id', $returned)->count(), 'a revision updates the row');
    }

    #[Test]
    public function the_ceo_confirms_proposed_or_old_reviewed_terms_once(): void
    {
        $ceo = $this->account('ceo');
        foreach (['proposed', 'ha_approved'] as $state) {
            $tx = $this->request();
            $this->terms($tx, $state);
            $this->act($ceo)->postJson('/api/v1/staff/financing/confirm', ['transaction_id' => $tx, 'decision' => 'confirm'])->assertOk();
            $this->assertSame('approved', DB::table('payment_terms')->where('purchase_transaction_id', $tx)->value('state'));
            $this->assertSame('approved_awaiting_buyer_decision', DB::table('transactions')->where('id', $tx)->value('flow_status'));
            $this->again()->postJson('/api/v1/staff/financing/confirm', ['transaction_id' => $tx, 'decision' => 'confirm'])->assertStatus(409)->assertJson(['message' => 'No financing terms to confirm.']);
        }
        $this->assertStringContainsString('Initial Downpayment ₱50,000, then ₱41,667 a month for 12 months on a balance of ₱500,000', DB::table('notifications')->where('kind', 'financing_offer')->value('body'));
        $this->act($this->account('sales_manager'))->postJson('/api/v1/staff/financing/confirm', ['transaction_id' => $tx, 'decision' => 'confirm'])->assertForbidden();

        // Head Accountant review stays for rows already in it, and a return needs a reason.
        $old = $this->request();
        $this->terms($old, 'proposed');
        $this->act($this->account('head_accountant'))->postJson('/api/v1/staff/financing/review', ['transaction_id' => $old, 'decision' => 'return'])->assertStatus(422)->assertJson(['message' => 'Say what needs to change.']);
        $this->again()->postJson('/api/v1/staff/financing/review', ['transaction_id' => $old, 'decision' => 'approve'])->assertOk();
        $this->assertSame('ha_approved', DB::table('payment_terms')->where('purchase_transaction_id', $old)->value('state'));
    }

    #[Test]
    public function confirming_a_delivery_sets_its_payments_and_holds_the_car(): void
    {
        $tx = $this->request('delivery');
        $this->terms($tx, 'proposed', ['delivery_fee' => '2500.00']);
        $ceo = $this->account('ceo');
        $this->act($ceo)->postJson('/api/v1/staff/financing/confirm', ['transaction_id' => $tx, 'decision' => 'confirm'])->assertStatus(422)->assertJson(['message' => 'The request has no delivery date.']);

        DB::table('viewing_arrangements')->insert(['id' => (string) Str::uuid(), 'purchase_transaction_id' => $tx, 'vehicle_id' => DB::table('transactions')->where('id', $tx)->value('vehicle_id'),
            'arrangement_kind' => 'delivery', 'schedule' => $this->slot(7), 'location' => 'Calamba', 'created_at' => now()]);
        $this->again()->postJson('/api/v1/staff/financing/confirm', ['transaction_id' => $tx, 'decision' => 'confirm'])->assertOk();
        $d = DB::table('purchase_details')->where('transaction_id', $tx)->first();
        $this->assertSame(['2500.00', '50000.00'], [$d->delivery_fee, $d->downpayment_amount]);
        $this->assertNotNull($d->downpayment_due_at);
        $this->assertSame('purchase_claim', DB::table('transactions')->where('id', $tx)->value('flow_status'));
        $this->assertStringContainsString('pay ₱52,500 now through PayMongo', DB::table('notifications')->where('kind', 'financing_offer')->value('body'));
        $this->assertSame(1, DB::table('notifications')->where('kind', 'delivery_payment_expected')->count());
    }

    #[Test]
    public function the_agreement_opens_the_account_only_when_its_arrangement_is_ready(): void
    {
        $ha = $this->account('head_accountant');
        $visit = $this->request('gce_visit', ['flow_status' => 'initial_dp_awaiting_verification']);
        $this->terms($visit, 'approved');
        $this->act($ha)->postJson('/api/v1/staff/financing/complete', ['transaction_id' => $visit])->assertStatus(422)->assertJson(['message' => 'Complete the agreement after the Initial Downpayment is confirmed.']);
        DB::table('transactions')->where('id', $visit)->update(['flow_status' => 'initial_dp_confirmed']);
        $this->again()->postJson('/api/v1/staff/financing/complete', ['transaction_id' => $visit])->assertOk();
        $account = DB::table('installment_accounts')->where('purchase_transaction_id', $visit)->first();
        $this->assertSame(['550000.00', '50000.00', '500000.00', 'active'], [$account->financed_total, $account->down_payment, $account->opening_balance, $account->state]);
        $amounts = DB::table('installments')->where('account_id', $account->id)->orderBy('sequence_no')->pluck('amount_due');
        $this->assertCount(12, $amounts);
        $this->assertSame(50_000_000, \App\Services\Finance\Money::sum($amounts->map(fn ($a) => (object) ['amount' => $a])), 'the schedule adds up to the financed amount');
        $this->assertSame(['financing_active', 'active'], [DB::table('transactions')->where('id', $visit)->value('flow_status'), DB::table('payment_terms')->where('purchase_transaction_id', $visit)->value('state')]);
        $this->again()->postJson('/api/v1/staff/financing/complete', ['transaction_id' => $visit])->assertStatus(422);
        $this->assertSame(1, DB::table('installment_accounts')->where('purchase_transaction_id', $visit)->count(), 'a repeat opens no second account');

        $meetup = $this->request('meetup');
        $this->terms($meetup, 'approved');
        $this->again()->postJson('/api/v1/staff/financing/complete', ['transaction_id' => $meetup])->assertStatus(422)
            ->assertJson(['message' => 'Complete the agreement after the Confidential Informant reports that the buyer signed.']);

        $delivery = $this->request('delivery', ['flow_status' => 'initial_dp_confirmed']);
        $this->terms($delivery, 'approved');
        $this->again()->postJson('/api/v1/staff/financing/complete', ['transaction_id' => $delivery])->assertStatus(422)
            ->assertJson(['message' => 'Complete the agreement after the car is delivered and the buyer accepts it.']);
    }
}
