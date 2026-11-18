<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `rbac_permissions`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RbacPermission extends Model
{
    use HasUuids;

    protected $table = 'rbac_permissions';

    const UPDATED_AT = null;

    public function accessAreaKey(): BelongsTo
    {
        return $this->belongsTo(RbacAccessArea::class, 'access_area_key', 'key');
    }

    public function actionKey(): BelongsTo
    {
        return $this->belongsTo(RbacAction::class, 'action_key', 'key');
    }
}
