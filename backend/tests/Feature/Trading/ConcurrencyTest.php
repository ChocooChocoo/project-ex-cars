<?php

namespace Tests\Feature\Trading;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Process\Process;
use Tests\Feature\Trading\Concerns\TradingFixtures;
use Tests\TestCase;

/**
 * Phase 5: simultaneous claims on one car or one visit slot against real MySQL. Several PHP processes send the
 * same kind of request at the same moment (trading:race); exactly one wins and every loser gets a stable
 * answer. Runs only against a local *_test database, because the fixtures must be committed for the other
 * processes to see them.
 */
class ConcurrencyTest extends TestCase
{
    use RefreshDatabase, TradingFixtures;

    private const TABLES = ['transactions', 'purchase_details', 'viewing_arrangements', 'transaction_status_history', 'transaction_documents',
        'notifications', 'inquiries', 'vehicles', 'customer_standing', 'audit_events', 'field_cases', 'sale_handovers'];

    protected function setUp(): void
    {
        parent::setUp();
        $db = DB::connection()->getDatabaseName();
        if (DB::getDriverName() !== 'mysql' || ! str_ends_with($db, '_test') || ! in_array(config('database.connections.mysql.host'), ['127.0.0.1', 'localhost'], true)) {
            $this->markTestSkipped("Needs a local MySQL *_test database, not {$db}.");
        }
        // The racing processes read committed rows only, so commit what this test writes and clean it up after.
        DB::commit();
    }

    protected function tearDown(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        foreach (self::TABLES as $table) {
            DB::table($table)->delete();
        }
        DB::table('users')->where('email', 'like', '%@test.local')->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        DB::beginTransaction(); // hand RefreshDatabase back the transaction it rolls back
        parent::tearDown();
    }

    /**
     * Starts every request at once, each in its own PHP process. Returns the HTTP statuses.
     *
     * @param  list<array{0: string, 1: string, 2: array}>  $requests  [userId, uri, payload]
     * @return list<int>
     */
    private function race(array $requests): array
    {
        $env = ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_DATABASE' => DB::connection()->getDatabaseName(), 'QUEUE_CONNECTION' => 'sync', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array'];
        $processes = array_map(fn ($r) => new Process([PHP_BINARY, 'artisan', 'trading:race', $r[0], 'POST', $r[1], json_encode($r[2])], base_path(), $env, null, 60), $requests);
        foreach ($processes as $process) {
            $process->start();
        }
        $statuses = [];
        foreach ($processes as $process) {
            $process->wait();
            if (str_contains($process->getOutput(), "500")) { fwrite(STDERR, $process->getErrorOutput()); }
            $statuses[] = (int) trim(collect(explode("\n", trim($process->getOutput())))->last());
        }
        sort($statuses);

        return $statuses;
    }

    #[Test]
    public function two_buyers_racing_for_one_car_get_one_active_request(): void
    {
        $vehicle = $this->vehicle();
        $requests = [];
        foreach (range(1, 4) as $i) {
            $buyer = $this->customer();
            $id = $this->buyRequest($buyer, $vehicle, 'cash', 'meetup', $this->slot(3, 9 + $i));
            $this->buyerDocuments($id, $buyer->id);
            $requests[] = [$buyer->id, '/api/v1/trading/submit-buy-request', ['transaction_id' => $id]];
        }
        $statuses = $this->race($requests);

        // Every buyer is answered; exactly one request holds the car, the rest wait On Hold, none twice.
        $this->assertSame([200, 200, 200, 200], $statuses);
        $this->assertSame(1, DB::table('transactions')->where('vehicle_id', $vehicle)->where('queue_state', 'active')->count());
        $this->assertSame(3, DB::table('transactions')->where('vehicle_id', $vehicle)->where('queue_state', 'on_hold')->count());
        $this->assertSame(4, DB::table('transaction_status_history')->whereIn('transaction_id', DB::table('transactions')->where('vehicle_id', $vehicle)->pluck('id'))->count());
    }

    #[Test]
    public function two_buyers_booking_the_same_visit_hour_get_one_slot(): void
    {
        $vehicle = $this->vehicle();
        $slot = $this->slot(4, 14)->toIso8601String();
        $requests = [];
        foreach (range(1, 3) as $i) {
            $buyer = $this->customer();
            $id = $this->buyRequest($buyer, $vehicle);
            $requests[] = [$buyer->id, '/api/v1/trading/buy-details', ['transaction_id' => $id, 'payment_method' => 'cash', 'arrangement_kind' => 'gce_visit', 'schedule' => $slot]];
        }
        $statuses = $this->race($requests);

        $this->assertSame([200, 409, 409], $statuses, 'one booking wins, the others get the stable "slot taken" conflict');
        $this->assertSame(1, DB::table('viewing_arrangements')->where('vehicle_id', $vehicle)->whereIn('confirmation_state', ['pending', 'confirmed'])->count());
    }

    #[Test]
    public function promoting_two_on_hold_requests_at_once_activates_one(): void
    {
        $vehicle = $this->vehicle();
        $sm = $this->account('sales_manager');
        $requests = [];
        foreach (range(1, 3) as $i) {
            $buyer = $this->customer();
            $id = $this->buyRequest($buyer, $vehicle, 'cash', 'meetup', $this->slot(3, 9 + $i), ['queue_state' => 'on_hold']);
            $requests[] = [$sm->id, '/api/v1/staff/trading/promote', ['transaction_id' => $id]];
        }
        $statuses = $this->race($requests);

        $this->assertSame([200, 409, 409], $statuses);
        $this->assertSame(1, DB::table('transactions')->where('vehicle_id', $vehicle)->where('queue_state', 'active')->count());
        $this->assertSame(1, DB::table('transaction_status_history')->where('reason', 'Promoted from On Hold to Active by the Sales Manager')->count());
    }

    #[Test]
    public function a_request_blocked_by_another_transactions_lock_gets_a_conflict_not_an_error(): void
    {
        $vehicle = $this->vehicle();
        $buyer = $this->customer();
        $id = $this->buyRequest($buyer, $vehicle, 'cash', 'meetup', $this->slot(3, 10));
        $this->buyerDocuments($id, $buyer->id);

        // Another connection holds the car row (as a slow request would) longer than the lock wait allows.
        config(['database.connections.mysql_other' => config('database.connections.mysql')]);
        $other = DB::connection('mysql_other');
        $other->beginTransaction();
        $other->table('vehicles')->where('id', $vehicle)->lockForUpdate()->first();
        DB::statement('SET SESSION innodb_lock_wait_timeout = 1');
        try {
            $this->act($buyer)->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $id])->assertStatus(409)->assertJson(['code' => 'conflict']);
        } finally {
            $other->rollBack();
            DB::statement('SET SESSION innodb_lock_wait_timeout = 50');
        }
        $this->assertSame('pending', DB::table('transactions')->where('id', $id)->value('current_state'));
        $this->assertSame(0, $this->historyCount($id));
        $this->again()->postJson('/api/v1/trading/submit-buy-request', ['transaction_id' => $id])->assertOk();
    }
}
