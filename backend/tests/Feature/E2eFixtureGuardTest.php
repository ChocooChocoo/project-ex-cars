<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** e2e:fixture writes test data; it runs on local, testing and the demo-data staging host, never in production. */
class E2eFixtureGuardTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function production_refuses_the_fixture_command(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('e2e:fixture', ['action' => 'customer-id'])
            ->expectsOutputToContain('only runs in local, testing or staging')
            ->assertFailed();
    }

    private function fixtureQuery(array $spec): mixed
    {
        Artisan::call('e2e:fixture', ['action' => 'query', 'arg' => rtrim(strtr(base64_encode(json_encode($spec)), '+/', '-_'), '=')]);

        return json_decode(Artisan::output(), true)['data'];
    }

    #[Test]
    public function query_reads_and_updates_with_checked_identifiers(): void
    {
        DB::table('roadmap_items')->insert(['id' => $id = (string) Str::uuid(), 'kind' => 'initiative', 'title' => 'A', 'created_at' => now(), 'updated_at' => now()]);
        $this->assertSame(['title' => 'A'], $this->fixtureQuery(['table' => 'roadmap_items', 'select' => 'title', 'filters' => [['eq', 'id', $id]], 'single' => true]));
        $this->assertSame(1, $this->fixtureQuery(['table' => 'roadmap_items', 'update' => ['title' => 'B'], 'filters' => [['in', 'id', [$id]]]]));
        $this->assertSame('B', DB::table('roadmap_items')->value('title'));
        $this->expectException(\InvalidArgumentException::class);
        $this->fixtureQuery(['table' => 'roadmap_items', 'select' => 'title', 'filters' => [['eq', 'id; drop', $id]]]);
    }
}
