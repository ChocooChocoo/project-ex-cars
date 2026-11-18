<?php

namespace App\Policies;

use App\Models\User;

/** private.staff_compensation was reachable only through list/add_staff_compensation RPCs. */
class StaffCompensationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole('ceo', 'account_manager', 'head_accountant');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('ceo', 'account_manager');
    }
}
