<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payment_terms`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PaymentTerm extends Model
{
    use HasUuids;

    protected $table = 'payment_terms';

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'down_payment' => 'decimal:2',
            'number_of_payments' => 'integer',
            'first_due_date' => 'date:Y-m-d',
            'approval_date' => 'immutable_datetime',
            'duration_months' => 'integer',
            'ha_reviewed_at' => 'immutable_datetime',
            'monthly_payment' => 'decimal:2',
            'delivery_fee' => 'decimal:2',
        ];
    }

    public function agreedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agreed_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_id');
    }

    public function haReviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'ha_reviewed_by');
    }

    public function purchaseTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'purchase_transaction_id');
    }
}
