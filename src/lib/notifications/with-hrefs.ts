import { notificationHref } from "./notification-href";

export interface NotificationRow {
  id: string;
  recipient_role: string | null;
  recipient_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  is_read: boolean;
  reference_table: string | null;
  reference_id: string | null;
  created_at: string;
  /** Page the notification opens, computed server-side by getNotifications (null: not clickable). */
  href?: string | null;
}

/** GET /api/v1/notifications (NotificationController@index). */
export interface NotificationPage {
  role: string | null;
  notifications: NotificationRow[];
  installment_transactions: Record<string, string>;
  assigned_field_cases: Record<string, string>;
  cursor: string | null;
}

/** Adds the link each row opens. Plain module: used by the layout render and by the popover's polling. */
export function withHrefs(page: NotificationPage): NotificationRow[] {
  const installments = new Map(Object.entries(page.installment_transactions));
  const fieldCases = new Map(Object.entries(page.assigned_field_cases));
  return page.notifications.map((row) => ({
    ...row,
    href: notificationHref(row, page.role, installments, fieldCases),
  }));
}
