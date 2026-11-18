<?php

namespace Tests\Feature\Auth\Concerns;

use App\Enums\Role;
use App\Models\User;
use App\Services\AccountService;

trait MakesAccounts
{
    protected const PASSWORD = 'Secret#123';

    protected function account(string $role, bool $verified = true, string $state = 'active'): User
    {
        $user = app(AccountService::class)->create(uniqid($role).'@test.local', self::PASSWORD, ucfirst($role).' Tester', Role::from($role), actor: null, verified: $verified);
        if ($state !== 'active') {
            $user->profile()->update(['account_state' => $state]);
        }

        return $user->fresh();
    }

    /** Requests from the Next.js origin, so Sanctum treats them as stateful (cookie session). */
    protected function fromFrontend(): static
    {
        return $this->withHeaders(['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/']);
    }

    /**
     * Like a new HTTP request: drop guards that cached the user from the previous call, so the user
     * is read again from the session (and its role/profile from the database).
     */
    protected function nextRequest(): static
    {
        $this->app['auth']->forgetGuards();

        return $this->fromFrontend();
    }

    protected function as(User $user): static
    {
        $this->app['auth']->forgetGuards();
        $this->app['cache']->flush(); // each simulated user starts with fresh rate-limit counters

        // Set the user on the guard the API routes use; switching users mid-test through `web` is not picked up by Sanctum's cached guard.
        return $this->actingAs($user, 'sanctum')->fromFrontend();
    }
}
