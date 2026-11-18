<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `recommendation_results`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RecommendationResult extends Model
{
    use HasUuids;

    protected $table = 'recommendation_results';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'budget_score' => 'decimal:2',
            'condition_score' => 'decimal:2',
            'fuel_score' => 'decimal:2',
            'demand_score' => 'decimal:2',
            'mileage_score' => 'decimal:2',
            'total_score' => 'decimal:2',
            'rank' => 'integer',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(RecommendationRun::class, 'run_id');
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'vehicle_id');
    }
}
