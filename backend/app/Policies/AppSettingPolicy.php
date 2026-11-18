<?php

namespace App\Policies;

use App\Models\User;

/** T06 settings (e.g. financing markup): CEO and Super Admin. Anyone may read (public RLS read). */
class AppSettingPolicy
{
    public function update(User $user): bool
    {
        return $user->hasRole('ceo', 'super_admin');
    }
}
