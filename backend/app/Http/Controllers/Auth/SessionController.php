<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Support\Rules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;

class SessionController extends Controller
{
    public function store(Request $request): MeResource|JsonResponse
    {
        $data = $request->validate(['email' => Rules::email(), 'password' => Rules::password(), 'remember' => ['sometimes', 'boolean']], Rules::messages());

        $guard = Auth::guard('web');
        if (! $guard->attempt(['email' => strtolower($data['email']), 'password' => $data['password']], $request->boolean('remember'))) {
            // Same wording Supabase returned, so the login form needs no change.
            return response()->json(['code' => 'invalid_credentials', 'message' => 'Invalid login credentials'], 422);
        }

        $user = $guard->user();
        $refusal = match (true) {
            ! $user->hasVerifiedEmail() => ['email_not_verified', 'Email not confirmed'],
            ! $user->isActive() => ['account_inactive', 'This account is not active. Contact GCE.'],
            default => null,
        };
        if ($refusal) {
            $this->endSession($request);

            return response()->json(['code' => $refusal[0], 'message' => $refusal[1]], 403);
        }

        // New session id on every login (session fixation).
        $request->session()->regenerate();

        return new MeResource($user);
    }

    public function destroy(Request $request): Response
    {
        $this->endSession($request);

        return response()->noContent();
    }

    private function endSession(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }
}
