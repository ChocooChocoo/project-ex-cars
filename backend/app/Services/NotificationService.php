<?php

namespace App\Services;

use App\Models\Notification;

/**
 * Writes in-app notifications (was src/lib/notifications/notify.ts). Enforces the rule MySQL cannot hold as
 * a CHECK: exactly one of recipient_role / recipient_id (Phase 2 rule mapping).
 */
class NotificationService
{
    /** @param  array{role?: string, userId?: string}  $to */
    public function send(array $to, string $kind, string $title, ?string $body, ?string $referenceTable = null, ?string $referenceId = null): Notification
    {
        $role = $to['role'] ?? null;
        $userId = $to['userId'] ?? null;
        if (($role === null) === ($userId === null)) {
            throw new \InvalidArgumentException('A notification needs exactly one recipient: a role or a user.');
        }
        $notification = (new Notification)->forceFill([
            'recipient_role' => $role, 'recipient_id' => $userId, 'kind' => $kind, 'title' => $title, 'body' => $body,
            'reference_table' => $referenceTable, 'reference_id' => $referenceId,
        ]);
        $notification->save();

        return $notification;
    }
}
