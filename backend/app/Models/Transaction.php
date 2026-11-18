<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `transactions`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Transaction extends Model
{
    use HasUuids;

    protected $table = 'transactions';

    protected function casts(): array
    {
        return [
            'opened_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'review_due_at' => 'immutable_datetime',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'customer_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
