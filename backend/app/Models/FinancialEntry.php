<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `financial_entries`). Mass assignment stays closed until a phase adds $fillable for its actor.
class FinancialEntry extends Model
{
    use HasUuids;

    protected $table = 'financial_entries';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
            'recorded_at' => 'immutable_datetime',
            'verified_at' => 'immutable_datetime',
        ];
    }

    public function fieldCase(): BelongsTo
    {
        return $this->belongsTo(FieldCase::class, 'field_case_id');
    }

    public function recordedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'recorded_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'verified_by');
    }
}
