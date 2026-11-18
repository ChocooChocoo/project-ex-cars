<?php

use App\Http\Controllers\AccountAdminController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\MeController;
use Illuminate\Support\Facades\Route;

// Browser and Next.js server adapters call these with Sanctum first-party cookies (no bearer tokens).
Route::prefix('v1')->group(function () {
    Route::prefix('auth')->group(function () {
        Route::post('login', [SessionController::class, 'store'])->middleware('throttle:login');
        Route::post('logout', [SessionController::class, 'destroy']);
        Route::post('register', [RegistrationController::class, 'store'])->middleware('throttle:auth-email');
        Route::post('email/resend', [RegistrationController::class, 'resend'])->middleware('throttle:auth-email');
        Route::get('email/verify/{id}/{hash}', [RegistrationController::class, 'verify'])
            ->middleware(['signed:relative', 'throttle:6,1'])->name('verification.verify');
        Route::get('email/change/{id}', [RegistrationController::class, 'confirmEmailChange'])
            ->middleware(['signed:relative', 'throttle:6,1'])->name('email.change.confirm');
        Route::post('password/forgot', [PasswordResetController::class, 'sendLink'])->middleware('throttle:auth-email');
        Route::post('password/reset', [PasswordResetController::class, 'reset'])->middleware('throttle:login');
    });

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::get('me', [MeController::class, 'show']);
        Route::patch('me/profile', [MeController::class, 'updateProfile']);
        Route::put('me/password', [MeController::class, 'updatePassword'])->middleware('throttle:login');
        Route::post('me/email', [MeController::class, 'requestEmailChange'])->middleware(['role:customer', 'throttle:auth-email']);
        Route::post('me/tutorial', [MeController::class, 'completeTutorial']);

        Route::post('admin/accounts/walk-in', [AccountAdminController::class, 'storeWalkIn'])->middleware('role:account_manager,ceo');
        Route::post('admin/accounts/employee', [AccountAdminController::class, 'storeEmployee'])->middleware('role:ceo,account_manager');
        Route::post('admin/roles', [AccountAdminController::class, 'assignRole'])->middleware('role:ceo,super_admin');
    });
});
