<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `reconditioning_fund_requests`). Mass assignment stays closed until a phase adds $fillable for its actor.
class ReconditioningFundRequest extends Model
{
    use HasUuids;

    protected $table = 'reconditioning_fund_requests';

    protected function casts(): array
    {
        return [
            'amount_cents' => 'integer',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function disbursement(): BelongsTo
    {
        return $this->belongsTo(DisbursementRequest::class, 'disbursement_id');
    }

    public function job(): BelongsTo
    {
        return $this->belongsTo(ReconditioningJob::class, 'job_id');
    }
}
