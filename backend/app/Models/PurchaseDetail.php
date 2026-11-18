<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `purchase_details`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PurchaseDetail extends Model
{
    use HasUuids;

    protected $table = 'purchase_details';

    protected function casts(): array
    {
        return [
            'final_price' => 'decimal:2',
            'checked_at' => 'immutable_datetime',
            'condition_acknowledged_at' => 'immutable_datetime',
            'delivery_serviceable' => 'boolean',
            'delivery_fee' => 'decimal:2',
            'downpayment_amount' => 'decimal:2',
            'downpayment_due_at' => 'immutable_datetime',
            'downpayment_forfeited_at' => 'immutable_datetime',
            'requested_term_months' => 'integer',
            'delivery_terms_agreed_at' => 'immutable_datetime',
            'cancellation_towing_ack_at' => 'immutable_datetime',
            'reschedule_pending_at' => 'immutable_datetime',
        ];
    }

    public function cancellationTowingAckBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancellation_towing_ack_by');
    }

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }
}
