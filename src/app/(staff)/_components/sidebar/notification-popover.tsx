"use client";

import { useMemo, useState } from "react";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { markAllNotificationsRead, markNotificationRead, type NotificationRow } from "@/lib/notifications/actions";
import { cn } from "@/lib/utils";

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface NotificationItemProps {
  notification: NotificationRow;
  onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
  const isUnread = !notification.is_read;

  return (
    <Item
      size="xs"
      variant={isUnread ? "muted" : "default"}
      onClick={() => {
        if (isUnread) onMarkRead(notification.id);
      }}
      className={cn(isUnread && "cursor-pointer hover:bg-muted")}
    >
      <ItemMedia>
        <span className={cn("size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {notification.title}
          <span className="font-normal text-muted-foreground text-xs">
            {formatTimeAgo(new Date(notification.created_at))}
          </span>
        </ItemTitle>
        {notification.body ? (
          <ItemDescription className={cn(isUnread && "text-foreground/75")}>{notification.body}</ItemDescription>
        ) : null}
      </ItemContent>
      <ItemActions>
        {isUnread ? (
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="Mark notification as read"
            onClick={(event) => {
              event.stopPropagation();
              onMarkRead(notification.id);
            }}
          >
            <CheckCheck />
          </Button>
        ) : null}
      </ItemActions>
    </Item>
  );
}

export function NotificationPopover({
  notifications: initialNotifications,
}: {
  readonly notifications: NotificationRow[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);

  const { active, unreadCount } = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      active: sorted,
      unreadCount: sorted.filter((n) => !n.is_read).length,
    };
  }, [notifications]);

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id && !n.is_read ? { ...n, is_read: true } : n)));
    void markNotificationRead(id).then((result) => {
      if (result.error) toast.error(result.error);
    });
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    void markAllNotificationsRead().then((result) => {
      if (result.error) toast.error(result.error);
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden p-0 sm:w-96">
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-sm leading-none">Notifications</h4>
            {unreadCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-amber-500/15 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400"
              >
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1 px-2 text-xs"
              onClick={handleMarkAllRead}
            >
              <CheckCheck />
              Mark all as read
            </Button>
          )}
        </div>
        {active.length > 0 ? (
          <ScrollArea className="h-80">
            <ItemGroup className="gap-1 px-4 pr-5 pb-4">
              {active.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onMarkRead={handleMarkRead} />
              ))}
            </ItemGroup>
          </ScrollArea>
        ) : (
          <Empty className="mt-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BellOff />
              </EmptyMedia>
              <EmptyTitle>You&apos;re all caught up</EmptyTitle>
              <EmptyDescription>No new notifications to show.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </PopoverContent>
    </Popover>
  );
}
