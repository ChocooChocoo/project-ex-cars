<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `security_duty_checks`). Mass assignment stays closed until a phase adds $fillable for its actor.
class SecurityDutyCheck extends Model
{
    use HasUuids;

    protected $table = 'security_duty_checks';

    protected function casts(): array
    {
        return [
            'duty_date' => 'date:Y-m-d',
            'completed_at' => 'immutable_datetime',
        ];
    }

    public function security(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'security_id');
    }
}
