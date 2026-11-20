<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Notes Part 1: a vehicle a supplier offers to GCE (table `supplier_vehicle_posts`). */
class SupplierVehiclePost extends Model
{
    use HasUuids;

    protected $table = 'supplier_vehicle_posts';

    protected function casts(): array
    {
        return ['asking_price' => 'decimal:2', 'photos' => 'array'];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supplier_id');
    }
}
