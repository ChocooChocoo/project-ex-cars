<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `rbac_role_permissions`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RbacRolePermission extends Model
{
    protected $table = 'rbac_role_permissions';

    protected $primaryKey = null;

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'assigned_at' => 'immutable_datetime',
        ];
    }

    public function permission(): BelongsTo
    {
        return $this->belongsTo(RbacPermission::class, 'permission_id');
    }

    public function roleKey(): BelongsTo
    {
        return $this->belongsTo(RbacRole::class, 'role_key', 'role_key');
    }
}
