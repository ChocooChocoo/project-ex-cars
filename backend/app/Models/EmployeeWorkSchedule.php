<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `employee_work_schedules`). Mass assignment stays closed until a phase adds $fillable for its actor.
class EmployeeWorkSchedule extends Model
{
    use HasUuids;

    protected $table = 'employee_work_schedules';

    protected function casts(): array
    {
        return [
            'workdays' => 'array',
            'grace_minutes' => 'integer',
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

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'updated_by');
    }
}
