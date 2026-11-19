<?php

namespace Tests\Feature\Finance;

use App\Services\Finance\FinancingJobs;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\Test;
use Tests\Feature\Finance\Concerns\FinanceFixtures;
use Tests\TestCase;

/** Phase 6: the scheduled financing jobs (was the payment-reminders cron route and the dashboard's due check). */
class ReminderTest extends TestCase
{
    use FinanceFixtures, RefreshDatabase;

    /** 9 PM Manila on 1 Mar 2033 is 13:00 UTC: the Manila date must be used, not the UTC one. */
    private function at(string $manila): CarbonImmutable
    {
        return CarbonImmutable::parse($manila, 'Asia/Manila');
    }

    #[Test]
    public function buyers_get_one_email_and_notice_per_reminder_window(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 3, '12500.50');
        $now = $this->at('2033-03-01 21:00');
        foreach (['2033-03-08', '2033-03-04', '2033-03-02'] as $i => $due) {
            DB::table('installments')->where('id', $sale['installments'][$i])->update(['due_date' => $due]);
        }
        DB::table('installments')->where('id', $sale['installments'][2])->update(['state' => 'paid']); // paid: no reminder
        $sent = [];
        Event::listen(MessageSending::class, function ($e) use (&$sent) {
            $sent[] = [$e->message->getTo()[0]->getAddress(), $e->message->getSubject(), $e->message->getTextBody()];
        });

        $this->assertSame(['sent' => 2, 'failed' => 0, 'failures' => []], FinancingJobs::reminders($now));
        $this->assertSame([[$buyer->email, 'GCE payment reminder: ₱12,500.50 due in 3 days'], [$buyer->email, 'GCE payment reminder: ₱12,500.50 due in 7 days']],
            array_map(fn ($m) => [$m[0], $m[1]], $sent));
        $this->assertStringContainsString('for 2021 Toyota Vios is due in 7 days, on 2033-03-08.', $sent[1][2]); // earliest due date first
        $this->assertSame(['₱12,500.50 due in 3 days', '₱12,500.50 due in 7 days'],
            DB::table('notifications')->where('kind', 'installment_reminder')->where('recipient_id', $buyer->id)->orderBy('body')->pluck('body')->all());

        // A second run the same day sends nothing again.
        $this->assertSame(['sent' => 0, 'failed' => 0, 'failures' => []], FinancingJobs::reminders($now));
        $this->assertCount(2, $sent);
    }

    #[Test]
    public function a_failed_email_releases_its_claim_so_a_later_run_retries_it(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 1);
        DB::table('installments')->where('id', $sale['installments'][0])->update(['due_date' => '2033-03-02']);
        $now = $this->at('2033-03-01 09:00');
        $email = $buyer->email;
        DB::table('users')->where('id', $buyer->id)->update(['email' => '']); // undeliverable on the first run

        $result = FinancingJobs::reminders($now);
        $this->assertSame([0, 1], [$result['sent'], $result['failed']]);
        $this->assertStringContainsString('The buyer has no email address.', $result['failures'][0]);
        $this->assertSame(0, DB::table('payment_reminders_sent')->count(), 'the claim is released');
        $this->assertSame(0, DB::table('notifications')->where('kind', 'installment_reminder')->count());

        DB::table('users')->where('id', $buyer->id)->update(['email' => $email]);
        Mail::fake();
        $this->assertSame(1, FinancingJobs::reminders($now)['sent'], 'the retry goes out');
        $this->assertSame(1, DB::table('payment_reminders_sent')->count());
    }

    #[Test]
    public function missed_installments_flag_the_account_once_and_warn_at_the_fourth(): void
    {
        $buyer = $this->customer();
        $sale = $this->financedSale($buyer, 5);
        foreach ($sale['installments'] as $i => $id) {
            DB::table('installments')->where('id', $id)->update(['due_date' => CarbonImmutable::parse('2033-03-01')->subMonths(4 - $i)->toDateString()]); // 4 past, 1 today
        }
        $now = $this->at('2033-03-01 21:00');

        FinancingJobs::installments($now);
        $states = DB::table('installments')->where('account_id', $sale['account'])->orderBy('sequence_no')->pluck('state')->all();
        $this->assertSame(['overdue', 'overdue', 'overdue', 'overdue', 'due'], $states);
        $this->assertNotNull(DB::table('installment_accounts')->where('id', $sale['account'])->value('flagged_at'));
        $this->assertSame(1, DB::table('notifications')->where('kind', 'financing_missed_payment')->count());
        $this->assertSame(1, DB::table('notifications')->where('kind', 'financing_repossession_due')->count());
        $this->assertSame(5, DB::table('notifications')->where('kind', 'installment_due')->where('recipient_role', 'account_manager')->count());
        $this->assertStringContainsString('is due today (2033-03-01). Contact the buyer.', DB::table('notifications')->where('kind', 'installment_due')->where('reference_id', $sale['installments'][4])->value('body'));

        // Hourly reruns add nothing.
        FinancingJobs::installments($now);
        $this->assertSame(7, DB::table('notifications')->count());
    }

    #[Test]
    public function the_scheduler_owns_the_financial_jobs(): void
    {
        $events = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())->mapWithKeys(fn ($e) => [$e->description => $e->expression.' '.($e->timezone ?? '')]);
        $this->assertSame('0 * * * * UTC', $events['finance:installments']);
        $this->assertSame('0 8 * * * Asia/Manila', $events['finance:reminders']);
        $this->assertArrayHasKey('trading:deadlines', $events);
    }
}
