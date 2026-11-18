<?php

use App\Http\Controllers\AccountAdminController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\RegistrationController;
use App\Http\Controllers\Auth\SessionController;
use App\Http\Controllers\Catalogue\ContentController;
use App\Http\Controllers\Catalogue\FavouriteController;
use App\Http\Controllers\Catalogue\InspectionController;
use App\Http\Controllers\Catalogue\RecommendationController;
use App\Http\Controllers\Catalogue\ShowroomController;
use App\Http\Controllers\Catalogue\StaffVehicleController;
use App\Http\Controllers\FileController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\Messaging\InquiryController;
use App\Http\Controllers\Messaging\NotificationController;
use App\Http\Controllers\ThumbnailController;
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

    // Public reads (landing page) and signed private-file links: the signature is the credential.
    Route::get('catalogue/landing', [ShowroomController::class, 'landing'])->middleware('throttle:60,1');
    Route::get('files/{bucket}/{path}', [FileController::class, 'show'])->where('path', '.*')
        ->middleware('signed:relative')->name('files.show');
    Route::get('thumbnail', [ThumbnailController::class, 'show'])->middleware('throttle:120,1');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::get('me', [MeController::class, 'show']);
        Route::patch('me/profile', [MeController::class, 'updateProfile']);
        Route::put('me/password', [MeController::class, 'updatePassword'])->middleware('throttle:login');
        Route::post('me/email', [MeController::class, 'requestEmailChange'])->middleware(['role:customer', 'throttle:auth-email']);
        Route::post('me/tutorial', [MeController::class, 'completeTutorial']);
        Route::post('me/avatar', [MeController::class, 'updateAvatar'])->middleware('throttle:20,1');
        Route::delete('me/avatar', [MeController::class, 'removeAvatar']);

        // Catalogue (Phase 4).
        Route::get('catalogue/vehicles', [ShowroomController::class, 'index']);
        Route::get('catalogue/vehicles/{id}', [ShowroomController::class, 'show']);
        Route::get('favourites', [FavouriteController::class, 'index']);
        Route::post('favourites/{vehicleId}', [FavouriteController::class, 'toggle']);
        Route::get('recommendations', [RecommendationController::class, 'index']);
        Route::post('recommendations', [RecommendationController::class, 'store'])->middleware('throttle:20,1');
        Route::get('recommendations/{runId}', [RecommendationController::class, 'show']);
        Route::post('recommendations/{runId}/feedback', [RecommendationController::class, 'feedback']);

        // Inquiries, messages and notifications (Phase 4). Browsers poll the `?after=` endpoints.
        Route::get('inquiries', [InquiryController::class, 'index']);
        Route::get('inquiries/unread-count', [InquiryController::class, 'unreadTotal']);
        Route::get('inquiries/{id}', [InquiryController::class, 'show']);
        Route::get('inquiries/{id}/messages', [InquiryController::class, 'messages'])->middleware('throttle:polling');
        Route::post('inquiries/{id}/messages', [InquiryController::class, 'storeMessage'])->middleware('throttle:30,1');
        Route::post('inquiries/{id}/read', [InquiryController::class, 'markRead']);
        Route::post('inquiries/{id}/reports', [InquiryController::class, 'report'])->middleware('throttle:10,1');
        Route::get('staff/message-reports', [InquiryController::class, 'reports'])->middleware('role:ceo,account_manager');
        Route::get('notifications', [NotificationController::class, 'index'])->middleware('throttle:polling');
        Route::get('notifications/count', [NotificationController::class, 'count']);
        Route::post('notifications/read-all', [NotificationController::class, 'markAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'markRead']);

        Route::middleware('role:ceo,account_manager,head_accountant,confidential_informant,marketing_specialist,mechanic,sales_manager,head_security')->prefix('staff')->group(function () {
            Route::get('vehicles', [StaffVehicleController::class, 'index']);
            Route::get('vehicles/{id}', [StaffVehicleController::class, 'show']);
        });
        Route::middleware('role:marketing_specialist')->prefix('staff')->group(function () {
            Route::post('vehicles/{id}/media', [StaffVehicleController::class, 'storeMedia']);
            Route::delete('vehicle-media/{mediaId}', [StaffVehicleController::class, 'destroyMedia']);
            Route::post('content', [ContentController::class, 'store']);
            Route::patch('content/{id}', [ContentController::class, 'update']);
            Route::post('content/{id}/publish', [ContentController::class, 'publish']);
            Route::delete('content/{id}', [ContentController::class, 'destroy']);
        });
        Route::get('staff/content', [ContentController::class, 'index'])->middleware('role:ceo,marketing_specialist');
        Route::middleware('role:ceo,account_manager,confidential_informant,mechanic,sales_manager')->prefix('staff')->group(function () {
            Route::get('inspections', [InspectionController::class, 'index']);
            Route::get('inspections/{id}', [InspectionController::class, 'show']);
        });

        Route::post('admin/accounts/walk-in', [AccountAdminController::class, 'storeWalkIn'])->middleware('role:account_manager,ceo');
        Route::post('admin/accounts/employee', [AccountAdminController::class, 'storeEmployee'])->middleware('role:ceo,account_manager');
        Route::post('admin/roles', [AccountAdminController::class, 'assignRole'])->middleware('role:ceo,super_admin');
    });
});
