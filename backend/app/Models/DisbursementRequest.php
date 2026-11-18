<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `disbursement_requests`). Mass assignment stays closed until a phase adds $fillable for its actor.
class DisbursementRequest extends Model
{
    use HasUuids;

    protected $table = 'disbursement_requests';

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'returned_cents' => 'integer',
            'returned_at' => 'immutable_datetime',
            'return_confirmed_at' => 'immutable_datetime',
        ];
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'approved_by');
    }

    public function fieldCase(): BelongsTo
    {
        return $this->belongsTo(FieldCase::class, 'field_case_id');
    }

    public function purchaseTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'purchase_transaction_id');
    }

    public function receivedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'received_by');
    }

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'released_by');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'requested_by');
    }

    public function returnConfirmedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'return_confirmed_by');
    }
}
