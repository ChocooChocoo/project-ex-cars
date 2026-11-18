<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payroll_approvals`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PayrollApproval extends Model
{
    use HasUuids;

    protected $table = 'payroll_approvals';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
        ];
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'reviewer_id');
    }
}
