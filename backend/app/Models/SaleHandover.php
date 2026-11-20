<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `sale_handovers`). Mass assignment stays closed until a phase adds $fillable for its actor.
class SaleHandover extends Model
{
    protected $table = 'sale_handovers';

    protected $primaryKey = 'transaction_id';

    protected $keyType = 'string';

    public $incrementing = false;

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'papers_updated_at' => 'immutable_datetime',
            'contract_signed_at' => 'immutable_datetime',
            'ci_copy_at' => 'immutable_datetime',
            'mechanic_copy_at' => 'immutable_datetime',
            'signing_reported_at' => 'immutable_datetime',
            'buyer_met_at' => 'immutable_datetime',
            'cash_reported_at' => 'immutable_datetime',
            'sm_signed_at' => 'immutable_datetime',
        ];
    }

    public function contractApprovedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contract_approved_by');
    }

    public function contractWrittenBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contract_written_by');
    }

    public function papersCi(): BelongsTo
    {
        return $this->belongsTo(User::class, 'papers_ci_id');
    }

    public function smSignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sm_signed_by');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(Transaction::class, 'transaction_id');
    }
}
