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
    protected $signature = 'trading:race {user} {method} {uri} {payload={}} {--raw : send the payload as the raw request body} {--header=* : extra "Name: value" headers} {--now= : frozen clock (ISO-8601), for time-window rules}';

    protected $description = 'Test-only: send one API request as a user (concurrency tests).';

    public function handle(Kernel $kernel): int
    {
        if (! app()->environment(['local', 'testing'])) {
            $this->error('trading:race only runs in local or testing.');

            return self::FAILURE;
        }
        if ($now = $this->option('now')) {
            \Carbon\Carbon::setTestNow($now);
            \Carbon\CarbonImmutable::setTestNow($now);
        }
        // "guest" sends the request without a session (the PayMongo webhook).
        if ($this->argument('user') !== 'guest') {
            $user = User::query()->findOrFail($this->argument('user'));
            auth()->guard('sanctum')->setUser($user);
            auth()->shouldUse('sanctum');
        }
        $server = ['HTTP_ACCEPT' => 'application/json'];
        foreach ($this->option('header') as $header) {
            [$name, $value] = array_map('trim', explode(':', $header, 2));
            $server['HTTP_'.strtoupper(str_replace('-', '_', $name))] = $value;
        }
        $raw = $this->option('raw');
        $request = Request::create($this->argument('uri'), strtoupper($this->argument('method')), $raw ? [] : (json_decode($this->argument('payload'), true) ?? []),
            server: $server + ($raw ? ['CONTENT_TYPE' => 'application/json'] : []), content: $raw ? $this->argument('payload') : null);
        $response = $kernel->handle($request);
        $this->line((string) $response->getStatusCode());
        if ($response->getStatusCode() >= 500) {
            fwrite(STDERR, substr((string) $response->getContent(), 0, 2000));
        }

        return self::SUCCESS;
    }
}
