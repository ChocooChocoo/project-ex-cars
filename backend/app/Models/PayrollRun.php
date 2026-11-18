<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `payroll_runs`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PayrollRun extends Model
{
    use HasUuids;

    protected $table = 'payroll_runs';

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
            'total_gross_cents' => 'integer',
            'total_deductions_cents' => 'integer',
            'total_net_cents' => 'integer',
        ];
    }

    public function preparedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'prepared_by');
    }
}
