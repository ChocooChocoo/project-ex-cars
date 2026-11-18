<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `employee_request_attachments`). Mass assignment stays closed until a phase adds $fillable for its actor.
class EmployeeRequestAttachment extends Model
{
    use HasUuids;

    protected $table = 'employee_request_attachments';

    const UPDATED_AT = null;

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(EmployeeRequest::class, 'request_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }
}
