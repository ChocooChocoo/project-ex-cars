<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `installment_accounts`). Mass assignment stays closed until a phase adds $fillable for its actor.
class InstallmentAccount extends Model
{
    use HasUuids;

    protected $table = 'installment_accounts';

    protected function casts(): array
    {
        return [
            'financed_total' => 'decimal:2',
            'down_payment' => 'decimal:2',
            'opening_balance' => 'decimal:2',
            'start_date' => 'date:Y-m-d',
            'closed_date' => 'date:Y-m-d',
            'flagged_at' => 'immutable_datetime',
        ];
    }

    public function purchaseTransaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'purchase_transaction_id');
    }
}
