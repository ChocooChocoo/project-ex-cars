<?php

namespace App\Notifications;

use App\Support\FrontendLink;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\URL;

/**
 * The verification link opens the Next.js /auth/confirm route, which calls the signed API URL and
 * relays the session cookie (the email can be opened on another device, so it must not depend on
 * an existing session).
 */
class VerifyEmailOnFrontend extends VerifyEmail
{
    protected function verificationUrl($notifiable): string
    {
        $api = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $notifiable->getKey(),
            'hash' => sha1($notifiable->getEmailForVerification()),
        ], absolute: false);

        return FrontendLink::confirm($api);
    }
}
