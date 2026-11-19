"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { type AnnouncementRow, AnnouncementsClient } from "./_components/announcements-client";

export default function AnnouncementsPage() {
  const allowed = useRequireRole(STAFF_ROLES);
  // Phase 7: the CEO sees every announcement; other staff see published, unexpired ones.
  const page = usePageData(allowed ? "announcements" : "announcements:denied", () =>
    allowed
      ? browserApi<{ canManage: boolean; announcements: AnnouncementRow[] }>("GET", "/api/v1/staff/announcements")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  return <AnnouncementsClient announcements={page.data.announcements} canManage={page.data.canManage} />;
}
