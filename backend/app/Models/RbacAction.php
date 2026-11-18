<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

// Generated from the final Supabase schema (table `rbac_actions`). Mass assignment stays closed until a phase adds $fillable for its actor.
class RbacAction extends Model
{
    protected $table = 'rbac_actions';

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }
}
