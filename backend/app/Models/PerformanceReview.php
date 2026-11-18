<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `performance_reviews`). Mass assignment stays closed until a phase adds $fillable for its actor.
class PerformanceReview extends Model
{
    use HasUuids;

    protected $table = 'performance_reviews';

    protected function casts(): array
    {
        return [
            'review_period_start' => 'date:Y-m-d',
            'review_period_end' => 'date:Y-m-d',
            'rating' => 'integer',
            'acknowledged_at' => 'immutable_datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'employee_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'reviewer_id');
    }
}
