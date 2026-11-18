<?php

namespace App\Policies;

use App\Models\User;
use App\Models\VehiclePriceProposal;

/** Approval roles: Marketing proposes, the CEO decides (vehicle_price_proposals RLS). */
class VehiclePriceProposalPolicy
{
    public function view(User $user): bool
    {
        return $user->hasRole('ceo', 'marketing_specialist', 'head_accountant');
    }

    public function create(User $user): bool
    {
        return $user->hasRole('marketing_specialist');
    }

    public function decide(User $user, VehiclePriceProposal $proposal): bool
    {
        return $user->hasRole('ceo') && $proposal->decision === 'pending';
    }
}
