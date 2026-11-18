<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `collection_actions`). Mass assignment stays closed until a phase adds $fillable for its actor.
class CollectionAction extends Model
{
    use HasUuids;

    protected $table = 'collection_actions';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'deadline' => 'date:Y-m-d',
            'action_time' => 'immutable_datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function installment(): BelongsTo
    {
        return $this->belongsTo(Installment::class, 'installment_id');
    }
}
