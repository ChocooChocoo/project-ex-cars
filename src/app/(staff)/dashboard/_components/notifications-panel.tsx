"use client";

import { useState } from "react";

import { Bell, Check } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { markNotificationRead, type NotificationRow } from "@/lib/notifications/actions";

export function NotificationsPanel({
  notifications: initialNotifications,
}: {
  readonly notifications: NotificationRow[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((n) => !n.is_read).length;

  async function handleMarkRead(id: string) {
    const result = await markNotificationRead(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="size-4" />
          Notifications
          {unread > 0 ? <Badge>{unread} unread</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {notifications.length === 0 ? (
          <p className="text-muted-foreground text-sm">No notifications.</p>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                n.is_read ? "opacity-60" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{n.title}</span>
                {n.body ? <span className="text-muted-foreground text-sm">{n.body}</span> : null}
                <span className="text-muted-foreground text-xs">{new Date(n.created_at).toLocaleString()}</span>
              </div>
              {!n.is_read ? (
                <Button size="sm" variant="ghost" onClick={() => handleMarkRead(n.id)}>
                  <Check data-icon="inline-start" />
                  Mark read
                </Button>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
