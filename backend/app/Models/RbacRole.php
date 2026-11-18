<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Generated from the final Supabase schema (table `rbac_roles`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RbacRole extends Model
{
    protected $table = 'rbac_roles';

    protected $primaryKey = 'role_key';

    protected $keyType = 'string';

    public $incrementing = false;

    protected function casts(): array
    {
        return [
            'is_protected' => 'boolean',
        ];
    }
}
