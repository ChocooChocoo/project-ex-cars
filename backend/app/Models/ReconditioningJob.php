<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `reconditioning_jobs`). Mass assignment stays closed until a phase adds $fillable for its actor.
class ReconditioningJob extends Model
{
    use HasUuids;

    protected $table = 'reconditioning_jobs';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'estimated_cost' => 'decimal:2',
            'actual_cost' => 'decimal:2',
            'papers_processed_at' => 'immutable_datetime',
            'completed_at' => 'immutable_datetime',
            'refund_due_cents' => 'integer',
            'refunded_at' => 'immutable_datetime',
        ];
    }

    public function disbursement(): BelongsTo
    {
        return $this->belongsTo(DisbursementRequest::class, 'disbursement_id');
    }

    public function mechanic(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mechanic_id');
    }

    public function papersProcessedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'papers_processed_by');
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
