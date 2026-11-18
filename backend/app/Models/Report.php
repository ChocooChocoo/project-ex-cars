<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `reports`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Report extends Model
{
    use HasUuids;

    protected $table = 'reports';

    protected function casts(): array
    {
        return [
            'period_start' => 'date:Y-m-d',
            'period_end' => 'date:Y-m-d',
        ];
    }

    public function submittedBy(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'submitted_by');
    }
}
