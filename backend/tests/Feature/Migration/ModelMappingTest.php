<?php

namespace Tests\Feature\Migration;

use App\Models\AttendanceEntry;
use App\Models\EmployeeWorkSchedule;
use App\Models\Profile;
use App\Models\Transaction;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\Test;
use ReflectionClass;
use ReflectionMethod;
use Tests\TestCase;

/** Every generated model reads seeded rows, resolves its foreign keys and casts money/dates without loss. */
class ModelMappingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        if (! str_ends_with(DB::connection()->getDatabaseName(), '_test')) {
            $this->markTestSkipped('Needs a local *_test database.');
        }
        // Seed inside this test's transaction (rolled back afterwards); media writes go to fake disks.
        Storage::fake('public');
        Storage::fake('local');
        $this->seed(DatabaseSeeder::class);
    }

    #[Test]
    public function every_table_has_a_model_and_every_belongs_to_resolves(): void
    {
        $tables = array_column(DB::select("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name NOT IN ('migrations', 'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens')"), 't');
        $models = [];
        foreach (glob(app_path('Models/*.php')) as $file) {
            $class = 'App\\Models\\'.basename($file, '.php');
            $models[(new $class)->getTable()] = $class;
        }
        $this->assertEqualsCanonicalizing($tables, array_keys($models), 'one model per table');

        foreach ($models as $table => $class) {
            $row = $class::query()->first();
            if (! $row) {
                continue; // table not seeded (e.g. reconditioning_*)
            }
            foreach ((new ReflectionClass($class))->getMethods(ReflectionMethod::IS_PUBLIC) as $m) {
                if ($m->class !== $class || (string) $m->getReturnType() !== BelongsTo::class) {
                    continue;
                }
                $relation = $row->{$m->name}();
                $fk = $relation->getForeignKeyName();
                if ($row->getAttribute($fk) !== null) {
                    $this->assertInstanceOf(Model::class, $relation->first(), "{$table}.{$fk} → {$m->name}()");
                }
            }
        }
    }

    #[Test]
    public function casts_keep_money_dates_and_json_exact(): void
    {
        $vehicle = Vehicle::query()->where('stock_code', 'GCE-001')->firstOrFail();
        $this->assertSame('495000.00', $vehicle->current_price);
        $this->assertSame('Toyota', $vehicle->make);

        $tx = Transaction::query()->whereNotNull('completed_at')->firstOrFail();
        $this->assertSame('UTC', $tx->opened_at->timezoneName);
        $this->assertInstanceOf(Vehicle::class, $tx->vehicle()->first());

        $schedule = EmployeeWorkSchedule::query()->firstOrFail();
        $this->assertIsArray($schedule->workdays);

        $attendance = AttendanceEntry::query()->whereNotNull('hours_worked')->firstOrFail();
        $this->assertMatchesRegularExpression('/^\d+\.\d{2}$/', $attendance->hours_worked);
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}$/', $attendance->toArray()['attendance_date']);

        $profile = Profile::query()->firstOrFail();
        $this->assertNotNull($profile->user()->first());
    }
}
