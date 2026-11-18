<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `sell_details`). Mass assignment stays closed until a phase adds $fillable for its actor.
class SellDetail extends Model
{
    use HasUuids;

    protected $table = 'sell_details';

    protected function casts(): array
    {
        return [
            'offered_amount' => 'decimal:2',
            'valuation_amount' => 'decimal:2',
            'decision_date' => 'immutable_datetime',
            'condition_items' => 'array',
            'has_known_issues' => 'boolean',
            'agreed_price' => 'decimal:2',
            'cleared_for_payment_at' => 'immutable_datetime',
            'owner_number' => 'integer',
        ];
    }

    public function decisionMaker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decision_maker_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }
}
