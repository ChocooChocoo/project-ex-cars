<?php

namespace Tests\Feature\Migration;

use Carbon\CarbonImmutable;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Proves the MySQL schema keeps the database rules the Supabase schema enforced.
 * Runs only against a disposable local *_test database.
 */
class SchemaParityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $db = DB::connection()->getDatabaseName();
        $host = config('database.connections.mysql.host');
        if (DB::getDriverName() !== 'mysql' || ! str_ends_with($db, '_test') || ! in_array($host, ['127.0.0.1', 'localhost'], true)) {
            $this->markTestSkipped("Refusing to run against {$host}/{$db}: needs a local MySQL *_test database.");
        }
    }

    private function user(): string
    {
        $id = (string) Str::uuid();
        DB::table('users')->insert(['id' => $id, 'email' => "{$id}@test.local", 'password' => 'x']);
        DB::table('profiles')->insert(['id' => $id]);

        return $id;
    }

    private function vehicle(): string
    {
        $id = (string) Str::uuid();
        DB::table('vehicles')->insert(['id' => $id, 'stock_code' => 'T-'.substr($id, 0, 8), 'make' => 'Toyota', 'model' => 'Vios', 'year' => 2021]);

        return $id;
    }

    private function transaction(string $customer, ?string $vehicle, array $extra = []): string
    {
        $id = (string) Str::uuid();
        DB::table('transactions')->insert(['id' => $id, 'customer_id' => $customer, 'created_by' => $customer, 'transaction_kind' => 'buy', 'vehicle_id' => $vehicle, ...$extra]);

        return $id;
    }

    private function assertRejected(callable $write, string $why): void
    {
        try {
            $write();
        } catch (QueryException) {
            $this->addToAssertionCount(1);

            return;
        }
        $this->fail("Expected the database to reject: {$why}");
    }

    #[Test]
    public function check_constraints_reject_invalid_values(): void
    {
        $u = $this->user();
        $this->assertRejected(fn () => DB::table('vehicles')->insert(['stock_code' => 'X1', 'make' => 'A', 'model' => 'B', 'year' => 2021, 'listing_state' => 'gone']), 'unknown listing_state');
        $this->assertRejected(fn () => DB::table('vehicles')->insert(['stock_code' => 'X2', 'make' => 'A', 'model' => 'B', 'year' => 1800]), 'year below 1900');
        $this->assertRejected(fn () => DB::table('profiles')->where('id', $u)->update(['region_code' => '12AB']), 'PSGC code not 9 digits');
        $this->assertRejected(fn () => DB::table('user_roles')->insert(['account_id' => $u, 'role' => 'vendor']), 'unknown role');
        $this->assertRejected(fn () => DB::table('customer_reviews')->insert(['transaction_id' => $this->transaction($u, null), 'customer_id' => $u, 'rating' => 5, 'body' => '   ']), 'blank review body');

        DB::table('profiles')->where('id', $u)->update(['region_code' => '040000000']);
        $this->assertSame('040000000', DB::table('profiles')->where('id', $u)->value('region_code'));
    }

    #[Test]
    public function one_active_buyer_per_vehicle(): void
    {
        $c = $this->user();
        $v = $this->vehicle();
        $this->transaction($c, $v, ['queue_state' => 'active']);
        $this->assertRejected(fn () => $this->transaction($c, $v, ['queue_state' => 'active']), 'second active buyer');
        $this->transaction($c, $v, ['queue_state' => 'on_hold']);
        $this->transaction($c, $v);
        $this->assertSame(3, DB::table('transactions')->where('vehicle_id', $v)->count());
    }

    #[Test]
    public function concurrent_claims_on_the_same_vehicle_cannot_both_commit(): void
    {
        // RefreshDatabase wraps each test in a transaction another connection cannot see, so commit fixtures first.
        DB::commit();
        $c = $this->user();
        $v = $this->vehicle();

        config(['database.connections.mysql_other' => config('database.connections.mysql')]);
        $other = DB::connection('mysql_other');
        $other->statement('SET SESSION innodb_lock_wait_timeout = 1');

        DB::beginTransaction();
        $this->transaction($c, $v, ['queue_state' => 'active']); // uncommitted claim
        try {
            $this->assertRejected(fn () => $other->table('transactions')->insert(['customer_id' => $c, 'created_by' => $c, 'transaction_kind' => 'buy', 'vehicle_id' => $v, 'queue_state' => 'active']), 'concurrent second active claim');
        } finally {
            DB::rollBack();
            $other->table('transactions')->where('vehicle_id', $v)->delete();
            DB::table('vehicles')->where('id', $v)->delete();
            DB::table('users')->where('id', $c)->delete();
            DB::beginTransaction(); // hand RefreshDatabase back the transaction it expects to roll back
        }
    }

    #[Test]
    public function one_pending_price_proposal_per_kind(): void
    {
        $ms = $this->user();
        $v = $this->vehicle();
        $row = fn (string $decision, string $kind = 'selling_price') => DB::table('vehicle_price_proposals')->insert(['vehicle_id' => $v, 'proposed_amount' => 1, 'proposer_id' => $ms, 'decision' => $decision, 'proposal_kind' => $kind]);
        $row('pending');
        $this->assertRejected(fn () => $row('pending'), 'second pending selling_price proposal');
        $row('pending', 'reprice');
        $row('rejected');
        $row('approved');
        $this->assertSame(4, DB::table('vehicle_price_proposals')->where('vehicle_id', $v)->count());
    }

    #[Test]
    public function gce_visit_slot_lock(): void
    {
        $v = $this->vehicle();
        $at = '2026-12-01 02:00:00';
        $row = fn (string $state, string $kind = 'gce_visit') => DB::table('viewing_arrangements')->insert(['vehicle_id' => $v, 'arrangement_kind' => $kind, 'schedule' => $at, 'confirmation_state' => $state, 'location' => 'GCE']);
        $row('pending');
        $this->assertRejected(fn () => $row('confirmed'), 'double-booked gce_visit slot');
        $row('cancelled');
        $row('completed');
        $row('pending', 'meetup');
        $this->assertSame(4, DB::table('viewing_arrangements')->where('vehicle_id', $v)->count());
    }

    #[Test]
    public function payment_uniqueness_live_installment_and_per_part(): void
    {
        $c = $this->user();
        $tx = $this->transaction($c, $this->vehicle());
        $acc = (string) Str::uuid();
        DB::table('installment_accounts')->insert(['id' => $acc, 'purchase_transaction_id' => $tx, 'financed_total' => 100, 'opening_balance' => 100, 'start_date' => '2026-01-01']);
        $inst = (string) Str::uuid();
        DB::table('installments')->insert(['id' => $inst, 'account_id' => $acc, 'sequence_no' => 1, 'due_date' => '2026-02-01', 'amount_due' => 50]);
        $pay = fn (array $x) => DB::table('payment_records')->insert(['transaction_id' => $tx, 'amount' => 50, 'method' => 'cash', 'recorded_by' => $c, 'settlement_date' => '2026-02-01', ...$x]);

        $pay(['installment_id' => $inst, 'payment_kind' => 'installment']);
        $this->assertRejected(fn () => $pay(['installment_id' => $inst, 'payment_kind' => 'installment']), 'second live payment for one installment');
        $pay(['installment_id' => $inst, 'payment_kind' => 'installment', 'rejected_at' => '2026-02-02 00:00:00', 'rejected_by' => $c]);

        $pay(['payment_kind' => 'balance', 'part_no' => 1]);
        $this->assertRejected(fn () => $pay(['payment_kind' => 'balance', 'part_no' => 1]), 'same balance part twice');
        $pay(['payment_kind' => 'balance', 'part_no' => 2]);
        $pay(['payment_kind' => 'reschedule_fee']);
        $pay(['payment_kind' => 'reschedule_fee']);
        $this->assertSame(6, DB::table('payment_records')->where('transaction_id', $tx)->count());
    }

    #[Test]
    public function one_open_reconditioning_job_and_one_live_field_budget(): void
    {
        $u = $this->user();
        $v = $this->vehicle();
        DB::table('reconditioning_jobs')->insert(['vehicle_id' => $v]);
        $this->assertRejected(fn () => DB::table('reconditioning_jobs')->insert(['vehicle_id' => $v, 'state' => 'in_progress']), 'second open job');
        DB::table('reconditioning_jobs')->where('vehicle_id', $v)->update(['state' => 'completed']);
        DB::table('reconditioning_jobs')->insert(['vehicle_id' => $v]);

        $case = (string) Str::uuid();
        DB::table('field_cases')->insert(['id' => $case, 'case_kind' => 'acquisition']);
        $budget = fn (string $status) => DB::table('disbursement_requests')->insert(['title' => 'Budget', 'amount_cents' => 100, 'purpose' => 'x', 'status' => $status, 'requested_by' => $u, 'field_case_id' => $case]);
        $budget('submitted');
        $this->assertRejected(fn () => $budget('approved'), 'second live field budget');
        $budget('rejected');
        $this->assertSame(2, DB::table('disbursement_requests')->where('field_case_id', $case)->count());
    }

    #[Test]
    public function datetimes_are_stored_in_utc(): void
    {
        $u = $this->user();
        $manila = CarbonImmutable::parse('2026-11-18 08:00:00', 'Asia/Manila');
        $tx = $this->transaction($u, null, ['opened_at' => $manila->utc()->format('Y-m-d H:i:s.u')]);
        $this->assertSame('2026-11-18 00:00:00.000000', DB::table('transactions')->where('id', $tx)->value('opened_at'));

        $created = CarbonImmutable::parse(DB::table('transactions')->where('id', $tx)->value('created_at'), 'UTC');
        $this->assertLessThan(60, abs($created->diffInSeconds(CarbonImmutable::now('UTC'))), 'CURRENT_TIMESTAMP default must be UTC');
    }

    #[Test]
    public function money_units_json_unicode_and_generated_columns_round_trip(): void
    {
        $u = $this->user();
        $tx = $this->transaction($u, null);

        // Peso decimals stay exact; cents stay integers.
        DB::table('purchase_details')->insert(['transaction_id' => $tx, 'payment_method' => 'cash', 'final_price' => '9999999999.99']);
        $purchase = DB::table('purchase_details')->where('transaction_id', $tx);
        $this->assertSame('9999999999.99', $purchase->value('final_price'));
        DB::table('financial_entries')->insert(['entry_kind' => 'revenue', 'amount_cents' => 9007199254740993, 'description' => 'big', 'recorded_by' => $u]);
        $this->assertSame(9007199254740993, (int) DB::table('financial_entries')->where('recorded_by', $u)->value('amount_cents'));

        // JSON default and Unicode text.
        $sellTx = $this->transaction($u, null, ['transaction_kind' => 'sell']);
        DB::table('sell_details')->insert(['transaction_id' => $sellTx]);
        $this->assertSame([], json_decode(DB::table('sell_details')->where('transaction_id', $sellTx)->value('condition_items'), true));
        DB::table('profiles')->where('id', $u)->update(['full_name' => 'Ñoño ₱20,000 🚗']);
        $this->assertSame('Ñoño ₱20,000 🚗', DB::table('profiles')->where('id', $u)->value('full_name'));

        // Nulls stay null (not empty strings or zero).
        $this->assertNull($purchase->value('delivery_fee'));

        // Generated columns.
        DB::table('attendance_entries')->insert(['employee_id' => $u, 'attendance_date' => '2026-11-18', 'time_in' => '2026-11-18 00:00:00', 'time_out' => '2026-11-18 08:30:00']);
        $this->assertSame('8.50', DB::table('attendance_entries')->where('employee_id', $u)->value('hours_worked'));
        DB::table('rbac_access_areas')->insert(['key' => 'parity_area', 'label' => 'Parity area', 'sort_order' => 990]);
        DB::table('rbac_actions')->insert(['key' => 'parity_action', 'label' => 'Parity action', 'sort_order' => 990]);
        DB::table('rbac_permissions')->insert(['access_area_key' => 'parity_area', 'action_key' => 'parity_action']);
        $this->assertSame('parity_area.parity_action', DB::table('rbac_permissions')->where('access_area_key', 'parity_area')->value('permission_key'));
    }

    #[Test]
    public function seeding_a_fresh_database_twice_gives_the_same_data(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $snapshot = function (): array {
            Artisan::call('migrate:fresh', ['--seed' => true, '--seeder' => DatabaseSeeder::class, '--force' => true]);
            $out = [];
            foreach (DB::select("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT IN ('migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens') ORDER BY 1") as $row) {
                $cols = array_column(DB::select("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND data_type <> 'datetime' AND column_name <> 'password' AND column_name NOT LIKE 'uq\\_%' ORDER BY ordinal_position", [$row->t]), 'c');
                $rows = DB::table($row->t)->select($cols)->get()->map(fn ($r) => preg_replace('/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/', 'uuid', json_encode($r)))->sort()->values()->all();
                $out[$row->t] = [count($rows), md5(implode("\n", $rows))];
            }

            return $out;
        };

        $first = $snapshot();
        $second = $snapshot();
        $this->assertSame($first, $second);
        $this->assertSame(16, $first['users'][0], 'one account per role plus the extra field staff');
        $this->assertSame(10, DB::table('user_roles')->distinct()->count('role'), 'all ten roles seeded');
        $this->assertSame(129, $first['rbac_permissions'][0]);
    }
}
