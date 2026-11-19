<?php

namespace App\Providers;

use App\Support\FrontendLink;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Events\ConnectionEstablished;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // MariaDB 11.6+ (the host runs 11.8) defaults innodb_snapshot_isolation=ON: a locking read (FOR UPDATE) of a
        // row another transaction changed after this one's snapshot fails with 1020 "Record has changed since last
        // read" instead of waiting and reading the latest row, as MySQL does. The lock-then-check workflows
        // (Trading::run, payments, attendance) rely on MySQL's behaviour, so turn it off for each MariaDB session.
        // Applied lazily before the first transaction on each PDO, so booting the app never opens a connection.
        Event::listen(ConnectionEstablished::class, function (ConnectionEstablished $event) {
            if ($event->connection->getDriverName() !== 'mysql') {
                return;
            }
            $applied = null;
            $event->connection->beforeStartingTransaction(function ($connection) use (&$applied) {
                $pdo = $connection->getPdo();
                if ($applied === spl_object_id($pdo)) {
                    return;
                }
                $applied = spl_object_id($pdo);
                $version = (string) $pdo->query('SELECT VERSION()')->fetchColumn();
                if (str_contains($version, 'MariaDB') && version_compare($version, '11.6', '>=')) {
                    $pdo->exec('SET SESSION innodb_snapshot_isolation = OFF');
                }
            });
        });

        // Brute-force limits: per email+IP for credentials, per IP for anything that sends email.
        RateLimiter::for('login', fn (Request $r) => Limit::perMinute(5)->by(strtolower((string) $r->input('email')).'|'.$r->ip())
            ->response(fn () => response()->json(['code' => 'rate_limited', 'message' => 'Too many attempts. Please wait a minute and try again.'], 429)));
        RateLimiter::for('auth-email', fn (Request $r) => Limit::perMinute(3)->by($r->ip())
            ->response(fn () => response()->json(['code' => 'rate_limited', 'message' => 'Too many emails sent. Please wait a few minutes and try again.'], 429)));

        // Polling (chat, notifications): one tab at 4 s is 15/min per endpoint; 60/min per user leaves room for a
        // few open tabs. ponytail: per-user ceiling only; revisit after measuring load on the Hostinger plan.
        RateLimiter::for('polling', fn (Request $r) => Limit::perMinute(60)->by($r->user()?->id ?: $r->ip()));

        ResetPassword::createUrlUsing(fn ($user, string $token) => FrontendLink::base().'/auth/v1/reset-password?'.http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]));
    }
}
