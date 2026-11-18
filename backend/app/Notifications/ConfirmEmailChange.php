<?php

namespace App\Notifications;

use App\Support\FrontendLink;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

/** Sent to the NEW address; the email changes only when that link is opened. */
class ConfirmEmailChange extends Notification
{
    public function __construct(private string $userId, private string $newEmail) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $api = URL::temporarySignedRoute('email.change.confirm', now()->addMinutes(60), [
            'id' => $this->userId,
            'email' => $this->newEmail,
        ], absolute: false);

        return (new MailMessage)
            ->subject('Confirm your new email address')
            ->line('Confirm that you want to sign in to Global Car Exchange with this email address.')
            ->action('Confirm email', FrontendLink::confirm($api, '/customer/profile'))
            ->line('If you did not ask for this change, ignore this email.');
    }
}
