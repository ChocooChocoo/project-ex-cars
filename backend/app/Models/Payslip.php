<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payslips`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Payslip extends Model
{
    use HasUuids;

    protected $table = 'payslips';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'gross_cents' => 'integer',
            'deductions_cents' => 'integer',
            'net_cents' => 'integer',
            'finalized_at' => 'immutable_datetime',
            'paid_at' => 'immutable_datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'employee_id');
    }

    public function paidBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'paid_by');
    }

    public function payrollRun(): BelongsTo
    {
        return $this->belongsTo(PayrollRun::class, 'payroll_run_id');
    }
}
