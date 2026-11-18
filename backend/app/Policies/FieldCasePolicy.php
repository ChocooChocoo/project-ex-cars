<?php

namespace App\Policies;

use App\Models\FieldCase;
use App\Models\User;

/** From the `field_cases` RLS policies (incl. 20261116100000_t11_field_case_assignment_rls). */
class FieldCasePolicy
{
    public function view(User $user, FieldCase $case): bool
    {
        return match (true) {
            $user->hasRole('ceo', 'sales_manager', 'head_accountant') => true,
            $user->hasRole('confidential_informant') => $case->assigned_confidential_informant === $user->id,
            $user->hasRole('mechanic') => $case->mechanic_id === $user->id,
            $user->hasRole('marketing_specialist') => $case->case_kind === 'acquisition',
            $user->hasRole('head_security') => $case->head_security_id === $user->id,
            default => false,
        };
    }

    /** Field staff update only cases assigned to them; changing the assignment itself is CEO/SM only. */
    public function update(User $user, FieldCase $case): bool
    {
        return match (true) {
            $user->hasRole('ceo', 'sales_manager') => true,
            $user->hasRole('confidential_informant') => $case->assigned_confidential_informant === $user->id,
            $user->hasRole('mechanic') => $case->mechanic_id === $user->id,
            $user->hasRole('head_security') => $case->case_kind === 'recovery' && $case->head_security_id === $user->id,
            default => false,
        };
    }

    public function assign(User $user): bool
    {
        return $user->hasRole('ceo', 'sales_manager');
    }
}
