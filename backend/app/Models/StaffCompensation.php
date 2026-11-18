<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `staff_compensation`). Mass assignment stays closed until a phase adds $fillable for its actor.
class StaffCompensation extends Model
{
    use HasUuids;

    protected $table = 'staff_compensation';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'base_salary_cents' => 'integer',
            'effective_from' => 'date:Y-m-d',
            'effective_until' => 'date:Y-m-d',
            'sss_contribution_cents' => 'integer',
            'pagibig_contribution_cents' => 'integer',
            'philhealth_contribution_cents' => 'integer',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'created_by');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'employee_id');
    }
}
