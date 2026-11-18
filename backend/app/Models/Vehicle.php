<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

// Generated from the final Supabase schema (table `vehicles`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Vehicle extends Model
{
    use HasUuids;

    protected $table = 'vehicles';

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'mileage' => 'integer',
            'current_price' => 'decimal:2',
            'posted_at' => 'immutable_datetime',
            'financing_markup_pct' => 'decimal:2',
        ];
    }
}
