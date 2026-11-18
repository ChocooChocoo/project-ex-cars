<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** route middleware `role:ceo,account_manager` — the role always comes from the session user, never the request. */
class EnsureRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (! $request->user()?->hasRole(...$roles)) {
            return response()->json(['code' => 'not_authorized', 'message' => 'You do not have permission for this action.'], 403);
        }

        return $next($request);
    }
}
