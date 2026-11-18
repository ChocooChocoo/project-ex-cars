<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `recommendation_feedback`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RecommendationFeedback extends Model
{
    use HasUuids;

    protected $table = 'recommendation_feedback';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'feedback_date' => 'immutable_datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(RecommendationRun::class, 'run_id');
    }

    public function selectedVehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class, 'selected_vehicle_id');
    }
}
