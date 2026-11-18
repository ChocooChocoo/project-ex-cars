<?php

namespace App\Http\Controllers\Auth;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Resources\MeResource;
use App\Models\User;
use App\Services\AccountService;
use App\Support\Rules;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RegistrationController extends Controller
{
    /** Customer self-sign-up. No session until the emailed link is opened (as with Supabase confirmations on). */
    public function store(Request $request, AccountService $accounts): JsonResponse
    {
        $data = $request->validate([
            'email' => [...Rules::email(), 'unique:users,email'],
            'password' => Rules::newPassword(),
            'full_name' => Rules::fullName(),
            'accept_terms' => ['accepted'],
            'accept_policy' => ['accepted'],
        ], [
            ...Rules::messages(),
            'email.unique' => 'This email is already registered. Please log in instead.',
            'accept_terms.accepted' => 'You must agree to the Terms and Conditions and the Company Policy.',
            'accept_policy.accepted' => 'You must agree to the Terms and Conditions and the Company Policy.',
        ]);

        $user = $accounts->create($data['email'], $data['password'], trim($data['full_name']), Role::Customer, actor: null, verified: false);
        $user->forceFill(['terms_accepted_at' => now()])->save();
        event(new Registered($user));

        return response()->json(['notice' => 'Check your email to verify your account.'], 201);
    }

    /** Signed link from the verification email (relayed by Next.js /auth/confirm). Verifies and signs in. */
    public function verify(Request $request, string $id, string $hash): MeResource|JsonResponse
    {
        $user = User::query()->findOrFail($id);
        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return response()->json(['code' => 'invalid_link', 'message' => 'This verification link is not valid.'], 403);
        }
        $user->markEmailAsVerified();

        return $this->signIn($request, $user);
    }

    /** Always 202, so the endpoint does not reveal which emails have accounts. */
    public function resend(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => Rules::email()], Rules::messages());
        $user = User::query()->where('email', strtolower($data['email']))->first();
        if ($user && ! $user->hasVerifiedEmail()) {
            $user->sendEmailVerificationNotification();
        }

        return response()->json(['notice' => 'If that account needs verifying, we sent a new link.'], 202);
    }

    /** Signed link sent to a customer's NEW address (MeController::requestEmailChange). */
    public function confirmEmailChange(Request $request, string $id): MeResource|JsonResponse
    {
        $email = strtolower((string) $request->query('email'));
        $user = User::query()->findOrFail($id);
        if (User::query()->where('email', $email)->whereKeyNot($user->id)->exists()) {
            return response()->json(['code' => 'conflict', 'message' => 'This email is already used by another account.'], 409);
        }
        $user->forceFill(['email' => $email, 'email_verified_at' => now()])->save();

        return $this->signIn($request, $user);
    }

    private function signIn(Request $request, User $user): MeResource|JsonResponse
    {
        if (! $user->isActive()) {
            return response()->json(['code' => 'account_inactive', 'message' => 'This account is not active. Contact GCE.'], 403);
        }
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return new MeResource($user);
    }
}
