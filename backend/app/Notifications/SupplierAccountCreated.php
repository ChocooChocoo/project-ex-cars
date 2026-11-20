<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Notes lines 36-39: the Account Manager creates the supplier's account and the supplier is told by email. The
 * mail carries a set-password link (the reset-password flow), never a password. Queued: the cron worker sends it.
 */
class SupplierAccountCreated extends ResetPassword implements ShouldQueue
{
    use Queueable;

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('You now have an account on the GCE website')
            ->line('Global Car Exchange created a supplier account for you. Set your password to sign in and post vehicles for GCE.')
            ->action('Set your password', $this->resetUrl($notifiable))
            ->line('This link expires in '.config('auth.passwords.'.config('auth.defaults.passwords').'.expire').' minutes. Ask GCE for a new one if it has expired.');
    }
}
