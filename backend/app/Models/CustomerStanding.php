<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `customer_standing`). Mass assignment stays closed until a phase adds $fillable for its actor.
class CustomerStanding extends Model
{
    protected $table = 'customer_standing';

    protected $primaryKey = 'account_id';

    protected $keyType = 'string';

    public $incrementing = false;

    const CREATED_AT = null;

    protected function casts(): array
    {
        return [
            'no_show_count' => 'integer',
            'strike_count' => 'integer',
            'gce_visit_only' => 'boolean',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(User::class, 'account_id');
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
