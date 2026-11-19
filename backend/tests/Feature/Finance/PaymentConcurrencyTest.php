<?php

namespace Tests\Feature\Finance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Process\Process;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/**
 * Phase 6: duplicate and simultaneous payment events against real MySQL. Several PHP processes send at the same
 * moment (trading:race); exactly one changes the payment and every other gets a stable answer, with no second
 * notification or ledger row. Runs only against a local *_test database (the fixtures must be committed).
 */
class PaymentConcurrencyTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    private const TABLES = ['payment_records', 'installments', 'installment_accounts', 'payment_terms', 'transactions', 'purchase_details', 'viewing_arrangements',
        'transaction_status_history', 'notifications', 'vehicles', 'audit_events', 'field_cases', 'sale_handovers', 'disbursement_requests', 'disbursement_events', 'sell_details', 'reconditioning_jobs'];

    protected function setUp(): void
    {
        parent::setUp();
        $db = DB::connection()->getDatabaseName();
        if (DB::getDriverName() !== 'mysql' || ! str_ends_with($db, '_test') || ! in_array(config('database.connections.mysql.host'), ['127.0.0.1', 'localhost'], true)) {
            $this->markTestSkipped("Needs a local MySQL *_test database, not {$db}.");
        }
        DB::commit();
    }

    protected function tearDown(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (self::TABLES as $table) {
            DB::table($table)->delete();
        }
        // Account rows too: later test classes read the first profile and expect its user to exist.
        $users = DB::table('users')->where('email', 'like', '%@test.local')->pluck('id');
        DB::table('profiles')->whereIn('id', $users)->delete();
        DB::table('user_roles')->whereIn('account_id', $users)->delete();
        DB::table('employee_work_schedules')->whereIn('employee_id', $users)->delete();
        DB::table('users')->whereIn('id', $users)->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        DB::beginTransaction();
        parent::tearDown();
    }

    /**
     * @param  list<array{user: string, uri: string, payload: string|array, headers?: list<string>}>  $requests
     * @return list<int> sorted HTTP statuses
     */
    private function race(array $requests): array
    {
        $env = ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_DATABASE' => DB::connection()->getDatabaseName(), 'QUEUE_CONNECTION' => 'sync',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'PAYMONGO_WEBHOOK_SECRET' => self::WEBHOOK_SECRET];
        $processes = array_map(function ($r) use ($env) {
            $raw = is_string($r['payload']);
            $cmd = [PHP_BINARY, 'artisan', 'trading:race', $r['user'], 'POST', $r['uri'], $raw ? $r['payload'] : json_encode($r['payload'])];
            if ($raw) {
                $cmd[] = '--raw';
            }
            foreach ($r['headers'] ?? [] as $h) {
                $cmd[] = '--header='.$h;
            }

            return new Process($cmd, base_path(), $env, null, 60);
        }, $requests);
        array_walk($processes, fn ($p) => $p->start());
        $statuses = [];
        foreach ($processes as $p) {
            $p->wait();
            if (str_contains($p->getOutput(), '500')) {
                fwrite(STDERR, $p->getErrorOutput());
            }
            $statuses[] = (int) trim(collect(explode("\n", trim($p->getOutput())))->last());
        }
        sort($statuses);

        return $statuses;
    }

    #[Test]
    public function redelivered_webhooks_arriving_together_mark_the_checkout_paid_once(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 3);
        $rows = array_map(fn ($i) => $this->checkoutRow($sale['tx'], 'cs_race', 'installment', '10000.00', $i), $sale['installments']);
        [$raw, $sig] = $this->paidEvent('cs_race', 3_000_000, $sale['tx']);

        $statuses = $this->race(array_fill(0, 4, ['user' => 'guest', 'uri' => '/api/v1/paymongo/webhook', 'payload' => $raw, 'headers' => ["Paymongo-Signature: {$sig}"]]));

        $this->assertSame([200, 200, 200, 200], $statuses, 'every delivery is acknowledged');
        $this->assertSame(3, DB::table('payment_records')->whereIn('id', $rows)->whereNotNull('paid_at')->count());
        $this->assertSame(3, DB::table('payment_records')->where('transaction_id', $sale['tx'])->count(), 'no extra ledger rows');
        $this->assertSame(2, DB::table('notifications')->where('kind', 'installment_awaiting_approval')->count(), 'one notice per role, not per delivery');
    }

    #[Test]
    public function two_staff_recording_the_same_cash_payment_record_it_once(): void
    {
        $buyer = $this->customer();
        $tx = $this->buyRequest($buyer, $this->vehicle(600000), 'cash', 'gce_visit', null, ['current_state' => 'approved']);
        $form = ['transaction_id' => $tx, 'amount' => 600000, 'method' => 'cash', 'settlement_date' => now()->toDateString()];
        $sms = [$this->account('sales_manager'), $this->account('sales_manager'), $this->account('ceo')];

        $statuses = $this->race(array_map(fn ($u) => ['user' => $u->id, 'uri' => '/api/v1/staff/payments/record', 'payload' => $form], $sms));

        $this->assertSame(200, $statuses[0]);
        $this->assertSame(1, collect($statuses)->filter(fn ($s) => $s === 200)->count());
        $this->assertEmpty(collect($statuses)->filter(fn ($s) => $s >= 500)->all());
        $this->assertSame(1, DB::table('payment_records')->where('transaction_id', $tx)->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'installment_recorded')->count());
    }

    #[Test]
    public function a_manual_installment_and_an_online_checkout_for_the_same_installment_keep_one_live_row(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 1);
        $sm = $this->account('sales_manager');
        $online = $this->checkoutRow($sale['tx'], 'cs_one', 'installment', '10000.00', $sale['installments'][0]);
        [$raw, $sig] = $this->paidEvent('cs_one', 1_000_000, $sale['tx']);
        $form = ['transaction_id' => $sale['tx'], 'installment_id' => $sale['installments'][0], 'amount' => 1, 'method' => 'cash', 'settlement_date' => now()->toDateString()];

        $statuses = $this->race([
            ['user' => 'guest', 'uri' => '/api/v1/paymongo/webhook', 'payload' => $raw, 'headers' => ["Paymongo-Signature: {$sig}"]],
            ['user' => $sm->id, 'uri' => '/api/v1/staff/payments/record', 'payload' => $form],
        ]);

        // The online row already holds the installment's place: the manual record is refused, the webhook lands.
        $this->assertSame([200, 409], $statuses);
        $this->assertSame(1, DB::table('payment_records')->where('installment_id', $sale['installments'][0])->whereNull('rejected_at')->count());
        $this->assertNotNull(DB::table('payment_records')->where('id', $online)->value('paid_at'));
    }

    #[Test]
    public function two_head_accountants_verifying_one_installment_pay_it_once(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 1);
        DB::table('payment_records')->insert(['id' => $id = (string) \Illuminate\Support\Str::uuid(), 'transaction_id' => $sale['tx'], 'installment_id' => $sale['installments'][0],
            'amount' => '10000.00', 'method' => 'cash', 'payment_kind' => 'installment', 'recorded_by' => $buyer->id, 'settlement_date' => now()->toDateString(), 'created_at' => now()]);
        $has = [$this->account('head_accountant'), $this->account('head_accountant'), $this->account('ceo')];

        $statuses = $this->race(array_map(fn ($u) => ['user' => $u->id, 'uri' => '/api/v1/staff/payments/verify', 'payload' => ['payment_id' => $id]], $has));

        $this->assertSame([200, 409, 409], $statuses);
        $this->assertSame('closed', DB::table('installment_accounts')->where('id', $sale['account'])->value('state'));
        $this->assertSame(1, DB::table('notifications')->where('kind', 'financing_completed')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'installment_verified')->where('recipient_id', $buyer->id)->count());
    }

    #[Test]
    public function the_requester_and_the_head_accountant_recording_the_seller_paid_together_pay_once(): void
    {
        $seller = $this->customer();
        $ms = $this->account('marketing_specialist');
        $vehicle = $this->vehicle(450000, 'draft');
        $tx = (string) \Illuminate\Support\Str::uuid();
        DB::table('transactions')->insert(['id' => $tx, 'customer_id' => $seller->id, 'created_by' => $seller->id, 'transaction_kind' => 'sell', 'vehicle_id' => $vehicle,
            'current_state' => 'approved', 'opened_at' => now(), 'created_at' => now(), 'updated_at' => now()]);
        DB::table('sell_details')->insert(['id' => (string) \Illuminate\Support\Str::uuid(), 'transaction_id' => $tx, 'agreed_price' => '450000.00', 'meetup_method' => 'gce_visit', 'cleared_for_payment_at' => now()]);
        DB::table('disbursement_requests')->insert(['id' => $id = (string) \Illuminate\Support\Str::uuid(), 'title' => 'Car purchase fund', 'amount_cents' => 45_000_000, 'purpose' => 'Car payment',
            'status' => 'released', 'requested_by' => $ms->id, 'purchase_transaction_id' => $tx, 'created_at' => now(), 'updated_at' => now()]);
        $users = [$ms, $this->account('head_accountant'), $ms];

        $statuses = $this->race(array_map(fn ($u) => ['user' => $u->id, 'uri' => '/api/v1/staff/finance/record-seller-paid', 'payload' => ['disbursement_id' => $id]], $users));

        $this->assertSame([200, 200, 200], $statuses, 'a repeat is a no-op, not an error');
        $this->assertSame(1, DB::table('disbursement_events')->where('disbursement_id', $id)->where('event_kind', 'paid')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'sell_payment_disbursed')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'sell_vehicle_ready_to_post')->count());
        $this->assertSame(1, DB::table('transaction_status_history')->where('transaction_id', $tx)->where('to_state', 'completed')->count());
    }
}
