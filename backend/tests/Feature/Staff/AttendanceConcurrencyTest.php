<?php

namespace Tests\Feature\Staff;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Symfony\Component\Process\Process;
use Tests\Feature\Staff\Concerns\StaffFixtures;
use Tests\TestCase;

/**
 * Phase 7: simultaneous clock-ins/outs from separate PHP processes against real MySQL (trading:race). Replaces the
 * pg_advisory_xact_lock in clock_in_attendance: exactly one entry per employee and day, including the race where
 * no attendance row exists yet. Needs a local MySQL *_test database (fixtures are committed).
 */
class AttendanceConcurrencyTest extends TestCase
{
    use RefreshDatabase, StaffFixtures;

    private const NOW = '2026-11-23T00:30:00Z'; // Monday 08:30 Manila

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
        foreach (['attendance_entries', 'employee_work_schedules', 'audit_events'] as $table) {
            DB::table($table)->delete();
        }
        $ids = DB::table('users')->where('email', 'like', '%@test.local')->pluck('id');
        DB::table('user_roles')->whereIn('account_id', $ids)->delete();
        DB::table('profiles')->whereIn('id', $ids)->delete();
        DB::table('users')->whereIn('id', $ids)->delete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        DB::beginTransaction();
        parent::tearDown();
    }

    /** @return list<int> sorted HTTP statuses */
    private function race(string $userId, string $uri, array $payload, int $times): array
    {
        $env = ['APP_ENV' => 'testing', 'DB_CONNECTION' => 'mysql', 'DB_DATABASE' => DB::connection()->getDatabaseName(), 'QUEUE_CONNECTION' => 'sync', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array'];
        $processes = [];
        foreach (range(1, $times) as $_) {
            $processes[] = new Process([PHP_BINARY, 'artisan', 'trading:race', $userId, 'POST', $uri, json_encode($payload), '--now='.self::NOW], base_path(), $env, null, 60);
        }
        foreach ($processes as $process) {
            $process->start();
        }
        $statuses = [];
        foreach ($processes as $process) {
            $process->wait();
            if (str_contains($process->getOutput(), '500')) {
                fwrite(STDERR, $process->getErrorOutput());
            }
            $statuses[] = (int) trim(collect(explode("\n", trim($process->getOutput())))->last());
        }
        sort($statuses);

        return $statuses;
    }

    #[Test]
    public function simultaneous_first_clock_ins_create_one_entry(): void
    {
        $mechanic = $this->employee('mechanic');
        $statuses = $this->race($mechanic->id, '/api/v1/staff/attendance/clock-in', self::AT_GCE, 5);

        $this->assertSame([200, 409, 409, 409, 409], $statuses);
        $this->assertSame(1, DB::table('attendance_entries')->where('employee_id', $mechanic->id)->count());
    }

    #[Test]
    public function simultaneous_clock_outs_close_the_open_entry_once(): void
    {
        $mechanic = $this->employee('mechanic');
        DB::table('attendance_entries')->insert(['id' => (string) Str::uuid(), 'employee_id' => $mechanic->id, 'attendance_date' => '2026-11-22',
            'time_in' => '2026-11-22 00:00:00', 'status' => 'present', 'schedule_timezone' => 'Asia/Manila', 'applied_grace_minutes' => 10, 'created_at' => now()]);
        // A stale open row blocks every clock-in; four clock-outs close it once.
        $this->assertSame([409, 409, 409], $this->race($mechanic->id, '/api/v1/staff/attendance/clock-in', self::AT_GCE, 3));
        $this->assertSame([200, 409, 409, 409], $this->race($mechanic->id, '/api/v1/staff/attendance/clock-out', [], 4));
        $this->assertSame(1, DB::table('attendance_entries')->where('employee_id', $mechanic->id)->whereNotNull('time_out')->count());
    }
}
