<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `user_roles`). Mass assignment stays closed until a phase adds $fillable for its actor.
class UserRole extends Model
{
    use HasUuids;

    protected $table = 'user_roles';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'assigned_at' => 'immutable_datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function assignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }
}
