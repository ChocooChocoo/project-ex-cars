<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Transaction;
use App\Models\User;

/** From the `transactions` RLS policies (final state) and roles.ts TRANSACTION_VIEWER_ROLES. Super Admin: never. */
class TransactionPolicy
{
    public function view(User $user, Transaction $tx): bool
    {
        if ($user->hasRole('customer')) {
            return $tx->customer_id === $user->id;
        }
        if (! $user->hasRole(...Role::TRANSACTION_VIEWERS)) {
            return false;
        }
        // Staff do not see a customer's buy draft until it is submitted (00055_t02_hide_unsubmitted_buys).
        $unsubmittedDraft = $tx->current_state === 'pending' && $tx->flow_status === null && $tx->queue_state === null && $tx->created_by === $tx->customer_id;
        if ($unsubmittedDraft) {
            return false;
        }

        return $user->hasRole('marketing_specialist') ? $tx->transaction_kind === 'sell' : true;
    }

    public function update(User $user, Transaction $tx): bool
    {
        return $user->hasRole('customer')
            ? $tx->customer_id === $user->id
            : $user->hasRole('ceo', 'sales_manager', 'account_manager', 'head_accountant');
    }
}
