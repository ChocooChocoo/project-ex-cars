<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Phase 5: trading deadline notices (lapsed 7-day review windows, unpaid delivery downpayments). Hostinger runs
// `php artisan schedule:run` from one hPanel cron entry (set up in Phase 6/8).
Artisan::command('trading:deadlines', function () {
    $this->info(\App\Services\Trading\Deadlines::notify().' notice(s) sent.');
})->purpose('Send trading deadline notices once per lapse');
// Hostinger disables proc_open, so Schedule::command (which spawns a process) fails there; run in-process instead.
\Illuminate\Support\Facades\Schedule::call(fn () => \App\Services\Trading\Deadlines::notify())
    ->name('trading:deadlines')->hourly()->withoutOverlapping();

// Phase 6: installment states, account flags and due notices (ran on each dashboard render), hourly; payment
// reminders 7/3/1 days ahead, daily at 8 AM Manila (the Vercel cron ran at 00:00 UTC).
Artisan::command('finance:installments', function () {
    $this->info(\App\Services\Finance\FinancingJobs::installments().' notice(s) sent.');
})->purpose('Flag missed installments and send due-installment notices');
Artisan::command('finance:reminders', function () {
    $result = \App\Services\Finance\FinancingJobs::reminders();
    $this->info("{$result['sent']} reminder(s) sent, {$result['failed']} failed.");
    foreach ($result['failures'] as $failure) {
        $this->error($failure);
    }
})->purpose('Email the 7/3/1-day installment reminders');
\Illuminate\Support\Facades\Schedule::call(fn () => \App\Services\Finance\FinancingJobs::installments())
    ->name('finance:installments')->hourly()->withoutOverlapping();
\Illuminate\Support\Facades\Schedule::call(fn () => \App\Services\Finance\FinancingJobs::reminders())
    ->name('finance:reminders')->dailyAt('08:00')->timezone('Asia/Manila')->withoutOverlapping();
