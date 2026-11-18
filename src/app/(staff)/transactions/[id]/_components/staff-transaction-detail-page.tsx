"use client";

import { notFound } from "next/navigation";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { TRANSACTION_VIEWER_ROLES } from "@/lib/auth/roles";
import { useRouteParam } from "@/lib/routing/use-route-param";

import { StaffTransactionDetail } from "./staff-transaction-detail";

type Detail = Parameters<typeof StaffTransactionDetail>[0];

/** Phase 5: loads transactions/[id] from Laravel, which applies the transaction record rules (404 otherwise). */
export function StaffTransactionDetailPage() {
  const id = useRouteParam("transactions");
  const allowed = useRequireRole(TRANSACTION_VIEWER_ROLES);
  const page = usePageData(allowed ? `staff-transaction/${id}` : "staff-transaction:denied", () =>
    allowed ? browserApi<Detail>("GET", `/api/v1/staff/transactions/${encodeURIComponent(id)}`) : Promise.resolve(null),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-6">
      <StaffTransactionDetail {...page.data} />
    </div>
  );
}
