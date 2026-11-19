<?php

namespace Tests\Feature;

use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/** e2e:fixture writes test data; it runs on local, testing and the demo-data staging host, never in production. */
class E2eFixtureGuardTest extends TestCase
{
    #[Test]
    public function production_refuses_the_fixture_command(): void
    {
        $this->app['env'] = 'production';

        $this->artisan('e2e:fixture', ['action' => 'customer-id'])
            ->expectsOutputToContain('only runs in local, testing or staging')
            ->assertFailed();
    }
}
