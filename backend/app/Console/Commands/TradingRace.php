<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Contracts\Http\Kernel;
use Illuminate\Http\Request;

/**
 * Test-only: sends one API request as a user from its own PHP process, so ConcurrencyTest can start several at
 * the same moment against MySQL and check that exactly one wins. Prints the HTTP status. Refused outside
 * local/testing.
 */
class TradingRace extends Command
{
    protected $signature = 'trading:race {user} {method} {uri} {payload={}}';

    protected $description = 'Test-only: send one API request as a user (concurrency tests).';

    public function handle(Kernel $kernel): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('trading:race only runs in local or testing.');

            return self::FAILURE;
        }
        $user = User::query()->findOrFail($this->argument('user'));
        auth()->guard('sanctum')->setUser($user);
        auth()->shouldUse('sanctum');
        $request = Request::create($this->argument('uri'), strtoupper($this->argument('method')), json_decode($this->argument('payload'), true) ?? [], server: ['HTTP_ACCEPT' => 'application/json']);
        $response = $kernel->handle($request);
        $this->line((string) $response->getStatusCode());
        if ($response->getStatusCode() >= 500) {
            fwrite(STDERR, substr((string) $response->getContent(), 0, 2000));
        }

        return self::SUCCESS;
    }
}
