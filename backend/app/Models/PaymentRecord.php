<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payment_records`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PaymentRecord extends Model
{
    use HasUuids;

    protected $table = 'payment_records';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'settlement_date' => 'date:Y-m-d',
            'paid_at' => 'immutable_datetime',
            'rejected_at' => 'immutable_datetime',
            'approved_at' => 'immutable_datetime',
            'part_no' => 'integer',
        ];
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function rejectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'submitted_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
