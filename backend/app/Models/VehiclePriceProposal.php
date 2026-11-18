<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `vehicle_price_proposals`). Mass assignment stays closed until a phase adds $fillable for its actor.
class VehiclePriceProposal extends Model
{
    use HasUuids;

    protected $table = 'vehicle_price_proposals';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'proposed_amount' => 'decimal:2',
            'decision_date' => 'immutable_datetime',
        ];
    }

    public function decider(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decider_id');
    }

    public function proposer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'proposer_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
