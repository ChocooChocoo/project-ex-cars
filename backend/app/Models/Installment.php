<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `installments`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Installment extends Model
{
    use HasUuids;

    protected $table = 'installments';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'sequence_no' => 'integer',
            'due_date' => 'date:Y-m-d',
            'amount_due' => 'decimal:2',
            'payment_date' => 'date:Y-m-d',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(InstallmentAccount::class, 'account_id');
    }
}
