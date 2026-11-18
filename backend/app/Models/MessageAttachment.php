<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

// Generated from the final Supabase schema (table `message_attachments`). Mass assignment stays closed until a phase adds $fillable for its actor.
class MessageAttachment extends Model
{
    use HasUuids;

    protected $table = 'message_attachments';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'file_size' => 'integer',
            'uploaded_at' => 'immutable_datetime',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(InquiryMessage::class, 'message_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploader_id');
    }
}
