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
\Illuminate\Support\Facades\Schedule::command('trading:deadlines')->hourly()->withoutOverlapping();
