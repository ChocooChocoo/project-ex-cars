<?php

namespace App\Services\Finance;

use App\Services\NotificationService;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Scheduled financing work (was checkAndNotifyDueInstallments in src/lib/notifications/actions.ts, which ran when the
 * dashboard rendered, and the Vercel cron src/app/api/cron/payment-reminders/route.ts). Both run from
 * `php artisan schedule:run`; dates are Manila business days.
 */
final class FinancingJobs
{
    public const REMINDER_DAYS = [7, 3, 1];

    /** §6 step 24 then the Account Manager's due notices; returns how many notices were written. */
    public static function installments(?CarbonImmutable $now = null): int
    {
        $today = ($now ?? CarbonImmutable::now())->setTimezone('Asia/Manila')->toDateString();
        $notices = app(NotificationService::class);
        $sent = 0;

        // Unpaid installments past due become overdue; today's become due.
        DB::table('installments')->where('due_date', '<', $today)->whereIn('state', ['upcoming', 'due'])->update(['state' => 'overdue']);
        DB::table('installments')->where('due_date', $today)->where('state', 'upcoming')->update(['state' => 'due']);

        foreach (DB::table('installment_accounts')->where('state', 'active')->pluck('id') as $accountId) {
            $sent += DB::transaction(function () use ($accountId, $today, $notices) {
                $account = DB::table('installment_accounts')->where('id', $accountId)->lockForUpdate()->first(['id', 'flagged_at', 'purchase_transaction_id', 'state']);
                $missed = DB::table('installments')->where('account_id', $accountId)->whereNotIn('state', ['paid', 'waived'])->where('due_date', '<', $today)->count();
                if ($account->state !== 'active' || $missed === 0) {
                    return 0;
                }
                $n = 0;
                if (! $account->flagged_at) {
                    DB::table('installment_accounts')->where('id', $accountId)->update(['flagged_at' => now(), 'updated_at' => now()]);
                    $notices->send(['role' => 'head_accountant'], 'financing_missed_payment', 'Financing account flagged',
                        'A buyer missed an installment. The account is flagged; follow up on the payment.', 'transactions', $account->purchase_transaction_id);
                    $n++;
                }
                // Q5 default (§6 step 24): repossession may start from the 4th missed installment.
                if ($missed >= 4 && ! DB::table('notifications')->where('kind', 'financing_repossession_due')->where('reference_id', $account->purchase_transaction_id)->exists()) {
                    $notices->send(['role' => 'head_accountant'], 'financing_repossession_due', 'Repossession may start',
                        "{$missed} installments are unpaid. Prepare the statement and instruct the repossession.", 'transactions', $account->purchase_transaction_id);
                    $n++;
                }

                return $n;
            });
        }

        // Once per installment that is due or overdue: the Account Manager contacts the buyer.
        $due = DB::table('installments as i')->join('installment_accounts as a', 'a.id', '=', 'i.account_id')->join('transactions as t', 't.id', '=', 'a.purchase_transaction_id')
            ->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')->where('i.due_date', '<=', $today)->whereNotIn('i.state', ['paid', 'waived'])
            ->whereNotExists(fn ($q) => $q->from('notifications as n')->whereColumn('n.reference_id', 'i.id')->where('n.reference_table', 'installments')->where('n.kind', 'installment_due'))
            ->get(['i.id', 'i.due_date', 'i.amount_due', 'v.make', 'v.model', 'v.year']);
        foreach ($due as $row) {
            $label = $row->make ? "{$row->year} {$row->make} {$row->model}" : 'a vehicle';
            $when = $row->due_date === $today ? "is due today ({$row->due_date})" : "was due on {$row->due_date}";
            $notices->send(['role' => 'account_manager'], 'installment_due', 'Installment due',
                'An installment of ₱'.Money::peso(Money::cents($row->amount_due))." for {$label} {$when}. Contact the buyer.", 'installments', $row->id);
            $sent++;
        }

        return $sent;
    }

    /**
     * T06: emails each financing buyer 7, 3 and 1 day before an installment is due and leaves the same reminder in
     * their notifications. The primary key (installment, days) claims each reminder once; a failed email releases
     * the claim so a later run retries it, and the failure is logged.
     *
     * @return array{sent: int, failed: int, failures: list<string>}
     */
    public static function reminders(?CarbonImmutable $now = null): array
    {
        $manila = ($now ?? CarbonImmutable::now())->setTimezone('Asia/Manila');
        $windows = [];
        foreach (self::REMINDER_DAYS as $days) {
            $windows[$manila->addDays($days)->toDateString()] = $days;
        }
        $rows = DB::table('installments as i')->join('installment_accounts as a', 'a.id', '=', 'i.account_id')->join('transactions as t', 't.id', '=', 'a.purchase_transaction_id')
            ->join('users as u', 'u.id', '=', 't.customer_id')->leftJoin('profiles as p', 'p.id', '=', 't.customer_id')->leftJoin('vehicles as v', 'v.id', '=', 't.vehicle_id')
            ->whereIn('i.due_date', array_keys($windows))->whereNotIn('i.state', ['paid', 'waived'])->orderBy('i.due_date')->orderBy('i.id')
            ->get(['i.id', 'i.due_date', 'i.amount_due', 't.id as transaction_id', 't.customer_id', 'u.email', 'p.full_name', 'v.make', 'v.model', 'v.year']);

        $sent = 0;
        $failures = [];
        foreach ($rows as $row) {
            $days = $windows[$row->due_date];
            try {
                DB::table('payment_reminders_sent')->insert(['installment_id' => $row->id, 'days_before' => $days, 'sent_at' => now()]);
            } catch (UniqueConstraintViolationException) {
                continue; // Another run already claimed it.
            }
            $message = self::message($row->full_name, Money::cents($row->amount_due), $row->due_date, $days, $row->make ? "{$row->year} {$row->make} {$row->model}" : 'your car');
            try {
                if (! $row->email) {
                    throw new \RuntimeException('The buyer has no email address.');
                }
                Mail::raw($message['text'], fn ($m) => $m->to($row->email)->subject($message['subject']));
            } catch (\Throwable $e) {
                DB::table('payment_reminders_sent')->where('installment_id', $row->id)->where('days_before', $days)->delete();
                $failures[] = "{$row->id}: {$e->getMessage()}";
                Log::error('Payment reminder not sent', ['installment' => $row->id, 'days_before' => $days, 'error' => $e->getMessage()]);

                continue;
            }
            app(NotificationService::class)->send(['userId' => $row->customer_id], 'installment_reminder', 'Payment reminder',
                str_replace('GCE payment reminder: ', '', $message['subject']), 'transactions', $row->transaction_id);
            $sent++;
        }

        return ['sent' => $sent, 'failed' => count($failures), 'failures' => $failures];
    }

    /** @return array{subject: string, text: string} (reminders.ts reminderMessage) */
    public static function message(?string $name, int $cents, string $dueDate, int $days, string $car): array
    {
        $pesos = number_format(intdiv($cents, 100) + ($cents % 100) / 100, 2);
        $when = $days === 1 ? 'tomorrow' : "in {$days} days";

        return [
            'subject' => "GCE payment reminder: ₱{$pesos} due {$when}",
            'text' => implode("\n", [
                'Hi '.($name ?? 'there').',',
                '',
                "Your In-House Financing installment of ₱{$pesos} for {$car} is due {$when}, on {$dueDate}.",
                'Open My Transactions in the GCE app. Use Payment for your next installment or Advanced Payment to select future installments. Pay a bank transfer online through PayMongo, or pay cash at GCE and the Sales Manager records it. The Head Accountant verifies every payment.',
                '',
                'If you have already paid, you can ignore this email.',
                '',
                'Global Exchange Car',
            ]),
        ];
    }
}
