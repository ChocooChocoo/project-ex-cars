<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Support\Rules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;

class PasswordResetController extends Controller
{
    /** Always 202: no account enumeration. The link points at the frontend (AppServiceProvider). */
    public function sendLink(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => Rules::email()], Rules::messages());
        Password::sendResetLink(['email' => strtolower($data['email'])]);

        return response()->json(['notice' => 'If an account uses that email, we sent a reset link.'], 202);
    }

    public function reset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => Rules::email(),
            'password' => Rules::newPassword(),
        ], Rules::messages());

        $status = Password::reset(['email' => strtolower($data['email'])] + $data, function (User $user, string $password) {
            // A reset ends every remembered login.
            $user->forceFill(['password' => $password, 'remember_token' => null])->save();
        });

        return $status === Password::PASSWORD_RESET
            ? response()->json(['notice' => 'Your password was reset. Please log in.'])
            : response()->json(['code' => 'invalid_link', 'message' => 'This reset link is invalid or has expired.'], 422);
    }
}
