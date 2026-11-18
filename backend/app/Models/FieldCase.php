<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `field_cases`). Mass assignment stays closed until a phase adds $fillable for its actor.
class FieldCase extends Model
{
    use HasUuids;

    protected $table = 'field_cases';

    protected function casts(): array
    {
        return [
            'schedule' => 'immutable_datetime',
            'completion_date' => 'immutable_datetime',
            'expenses_cents' => 'integer',
            'accepted_at' => 'immutable_datetime',
            'identity_confirmed_at' => 'immutable_datetime',
            'plate_confirmed_at' => 'immutable_datetime',
            'repair_estimate' => 'decimal:2',
            'inspected_at' => 'immutable_datetime',
            'expected_arrival' => 'immutable_datetime',
            'ci_received_at' => 'immutable_datetime',
            'mechanic_received_at' => 'immutable_datetime',
            'updated_price' => 'decimal:2',
            'discount_amount' => 'decimal:2',
            'last_lat' => 'float',
            'last_lng' => 'float',
            'last_located_at' => 'immutable_datetime',
        ];
    }

    public function assignedConfidentialInformant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_confidential_informant');
    }

    public function headSecurity(): BelongsTo
    {
        return $this->belongsTo(User::class, 'head_security_id');
    }

    public function identityConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'identity_confirmed_by');
    }

    public function mechanic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function plateConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'plate_confirmed_by');
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
