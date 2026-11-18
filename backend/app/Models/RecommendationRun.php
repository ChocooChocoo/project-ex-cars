<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `recommendation_runs`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RecommendationRun extends Model
{
    use HasUuids;

    protected $table = 'recommendation_runs';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'budget' => 'decimal:2',
            'run_date' => 'immutable_datetime',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_id');
    }
}
