<?php

use App\Http\Middleware\EnsureActiveAccount;
use App\Http\Middleware\EnsureRole;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Sanctum first-party cookie sessions for the Next.js origin (SANCTUM_STATEFUL_DOMAINS).
        $middleware->statefulApi();
        $middleware->alias(['role' => EnsureRole::class, 'active' => EnsureActiveAccount::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every API failure has the shape the Next.js action contracts expect: { code, message, fieldErrors? }.
        // The adapters map `code` straight to ActionFailure.code.
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['code' => 'validation_error', 'message' => $e->validator->errors()->first(), 'fieldErrors' => $e->errors()], 422);
            }
        });
        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['code' => 'not_authenticated', 'message' => 'You must be signed in.'], 401);
            }
        });
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['code' => 'not_authorized', 'message' => 'You do not have permission for this action.'], 403);
            }
        });
        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['code' => 'not_found', 'message' => 'Resource not found.'], 404);
            }
        });
        $exceptions->render(function (TokenMismatchException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['code' => 'csrf_mismatch', 'message' => 'Your session expired. Refresh the page and try again.'], 419);
            }
        });
        // Phase 5: a row lock held by a concurrent request (lock wait timeout 1205, deadlock 1213) or a unique key
        // the request lost to (1062) is a stable conflict for the loser, not a server error.
        // DeadlockException (a nested transaction's deadlock) is a PDOException, not a QueryException.
        $exceptions->render(function (\PDOException $e, Request $request) {
            $code = (int) ($e->errorInfo[1] ?? 0);
            if ($request->is('api/*') && (in_array($code, [1062, 1205, 1213], true) || $e->getCode() === '40001')) {
                return response()->json(['code' => 'conflict', 'message' => 'Someone else changed this record at the same moment. Refresh and try again.'], 409);
            }
        });
        $exceptions->render(function (HttpException $e, Request $request) {
            if ($request->is('api/*')) {
                $code = match ($e->getStatusCode()) {
                    403 => 'not_authorized', 404 => 'not_found', 409 => 'conflict', 419 => 'csrf_mismatch', 429 => 'rate_limited', default => 'http_error',
                };

                return response()->json(['code' => $code, 'message' => $e->getMessage() ?: 'Request failed.'], $e->getStatusCode(), $e->getHeaders());
            }
        });
    })->create();
