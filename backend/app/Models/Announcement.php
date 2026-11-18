<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `announcements`). Mass assignment stays closed until a phase adds $fillable for its actor.
class Announcement extends Model
{
    use HasUuids;

    protected $table = 'announcements';

    protected function casts(): array
    {
        return [
            'published_at' => 'immutable_datetime',
            'expires_at' => 'immutable_datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(Profile::class, 'author_id');
    }
}
