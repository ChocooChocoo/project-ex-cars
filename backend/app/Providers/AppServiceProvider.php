<?php

namespace App\Providers;

use App\Support\FrontendLink;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Brute-force limits: per email+IP for credentials, per IP for anything that sends email.
        RateLimiter::for('login', fn (Request $r) => Limit::perMinute(5)->by(strtolower((string) $r->input('email')).'|'.$r->ip())
            ->response(fn () => response()->json(['code' => 'rate_limited', 'message' => 'Too many attempts. Please wait a minute and try again.'], 429)));
        RateLimiter::for('auth-email', fn (Request $r) => Limit::perMinute(3)->by($r->ip())
            ->response(fn () => response()->json(['code' => 'rate_limited', 'message' => 'Too many emails sent. Please wait a few minutes and try again.'], 429)));

        ResetPassword::createUrlUsing(fn ($user, string $token) => FrontendLink::base().'/auth/v1/reset-password?'.http_build_query(['token' => $token, 'email' => $user->getEmailForPasswordReset()]));
    }
}
