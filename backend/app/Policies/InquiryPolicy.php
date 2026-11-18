<?php

namespace App\Policies;

use App\Models\Inquiry;
use App\Models\User;

/** From the `inquiries` RLS policies. */
class InquiryPolicy
{
    public function view(User $user, Inquiry $inquiry): bool
    {
        return match (true) {
            $user->hasRole('customer') => $inquiry->customer_id === $user->id,
            $user->hasRole('ceo', 'account_manager') => true,
            $user->hasRole('sales_manager') => in_array($inquiry->intention_kind, ['buy_now', 'buy_financing'], true),
            $user->hasRole('marketing_specialist') => $inquiry->intention_kind === 'sell_negotiation',
            default => false,
        };
    }

    /** The assigned AM/SM, or an AM/SM claiming an unassigned inquiry (the claim must assign themselves). */
    public function update(User $user, Inquiry $inquiry): bool
    {
        if ($user->hasRole('account_manager')) {
            return in_array($inquiry->assigned_account_manager, [null, $user->id], true);
        }
        if ($user->hasRole('sales_manager')) {
            return in_array($inquiry->assigned_sales_manager, [null, $user->id], true);
        }

        return false;
    }
}
