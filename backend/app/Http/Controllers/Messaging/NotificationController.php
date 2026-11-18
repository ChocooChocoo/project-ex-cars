<?php

namespace App\Http\Controllers\Messaging;

use App\Http\Controllers\Controller;
use App\Models\FieldCase;
use App\Models\Installment;
use App\Models\Notification;
use App\Models\User;
use App\Support\ApiRow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The caller's notifications: rows addressed to their role or to them (was lib/notifications/actions.ts).
 * Next.js turns each row into a link with notificationHref() from the two lookup maps returned here.
 */
class NotificationController extends Controller
{
    /** GET /notifications?after=<created_at cursor>: newest 20, or (when polling) rows created since the cursor. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = $this->mine($user)->orderByDesc('created_at')->orderByDesc('id');
        $after = $request->query('after');
        if (is_string($after) && preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/', $after)) {
            // Same overlap as message polling; the popover drops duplicates by id.
            $since = CarbonImmutable::parse($after, 'UTC')->min(CarbonImmutable::now('UTC'));
            $query->where('created_at', '>=', $since->subSeconds(5));
        }
        $rows = $query->limit(20)->get();

        // Installment reminders open the purchase transaction the installment belongs to.
        $installmentTransactions = Installment::query()
            ->join('installment_accounts', 'installment_accounts.id', '=', 'installments.account_id')
            ->whereIn('installments.id', $rows->where('reference_table', 'installments')->pluck('reference_id')->filter())
            ->whereNotNull('installment_accounts.purchase_transaction_id')
            ->pluck('installment_accounts.purchase_transaction_id', 'installments.id');

        // Mechanic and Head Security cannot open transactions; their alerts open the field case assigned to them.
        $assignedFieldCases = [];
        $transactionIds = $rows->where('reference_table', 'transactions')->pluck('reference_id')->filter();
        if ($user->hasRole('mechanic', 'head_security') && $transactionIds->isNotEmpty()) {
            $cases = FieldCase::query()->whereIn('transaction_id', $transactionIds)
                ->where(fn (Builder $q) => $q->where('mechanic_id', $user->id)->orWhere('head_security_id', $user->id))
                ->orderByDesc('created_at')->get(['id', 'transaction_id']);
            foreach ($cases as $case) {
                $assignedFieldCases[$case->transaction_id] ??= $case->id;
            }
        }

        return response()->json([
            'role' => $user->role()?->value,
            'notifications' => ApiRow::list($rows),
            'installment_transactions' => (object) $installmentTransactions->all(),
            'assigned_field_cases' => (object) $assignedFieldCases,
            // Capped at the server clock, like the message cursor.
            'cursor' => ($rows->max('created_at') ?? (is_string($after) ? CarbonImmutable::parse($after, 'UTC') : null))
                ?->min(CarbonImmutable::now('UTC'))->format('Y-m-d\TH:i:s.u\Z'),
        ]);
    }

    public function count(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->mine($request->user())->where('is_read', false)->count()]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        // Another user's or role's row answers 404, the same as a missing one.
        $notification = $this->mine($request->user())->whereKey($id)->firstOrFail();
        $notification->forceFill(['is_read' => true])->save();

        return response()->json(['success' => true]);
    }

    public function markAll(Request $request): JsonResponse
    {
        $count = $this->mine($request->user())->where('is_read', false)->update(['is_read' => true]);

        return response()->json(['marked' => $count]);
    }

    private function mine(User $user): Builder
    {
        $role = $user->role()?->value;

        return Notification::query()->where(fn (Builder $q) => $q->where('recipient_id', $user->id)
            ->when($role, fn (Builder $q) => $q->orWhere('recipient_role', $role)));
    }
}
