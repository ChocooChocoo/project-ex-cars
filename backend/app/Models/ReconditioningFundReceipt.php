<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `reconditioning_fund_receipts`). Mass assignment stays closed until a phase adds $fillable for its actor.
class ReconditioningFundReceipt extends Model
{
    use HasUuids;

    protected $table = 'reconditioning_fund_receipts';

    const UPDATED_AT = null;

    public function fundRequest(): BelongsTo
    {
        return $this->belongsTo(ReconditioningFundRequest::class, 'fund_request_id');
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
