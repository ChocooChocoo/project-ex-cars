<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `attendance_entries`). Mass assignment stays closed until a phase adds $fillable for its actor.
class AttendanceEntry extends Model
{
    use HasUuids;

    protected $table = 'attendance_entries';

    protected function casts(): array
    {
        return [
            'attendance_date' => 'date:Y-m-d',
            'time_in' => 'immutable_datetime',
            'time_out' => 'immutable_datetime',
            'hours_worked' => 'decimal:2',
            'checked_at' => 'immutable_datetime',
            'scheduled_start_at' => 'immutable_datetime',
            'scheduled_end_at' => 'immutable_datetime',
            'applied_grace_minutes' => 'integer',
            'late_minutes' => 'integer',
            'clock_in_lat' => 'float',
            'clock_in_lng' => 'float',
            'clock_in_distance_m' => 'float',
        ];
    }

    public function checkedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'checked_by');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'employee_id');
    }
}
