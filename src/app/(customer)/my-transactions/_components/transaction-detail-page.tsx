"use client";

import { notFound } from "next/navigation";

import { useSession } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import type { ProfileAutoFill } from "@/lib/autofill";
import { useRouteParam } from "@/lib/routing/use-route-param";
import type { SignedTransactionDocument } from "@/lib/transactions/document-media";

import { TransactionDetail } from "./transaction-detail";

type Detail = Omit<Parameters<typeof TransactionDetail>[0], "autofill"> & { documents: SignedTransactionDocument[] };

/** Phase 5: loads my-transactions/[id] from Laravel (the customer's own transaction only; another id is a 404). */
export function TransactionDetailPage() {
  const id = useRouteParam("my-transactions");
  const me = useSession();
  const page = usePageData(`my-transaction/${id}`, () =>
    browserApi<Detail>("GET", `/api/v1/my-transactions/${encodeURIComponent(id)}`),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;

  // The profile the buy form starts from, as getProfileAutoFill() read it from the session.
  const autofill: ProfileAutoFill = {
    full_name: me.profile.full_name,
    email: me.email,
    phone: me.profile.phone,
    address: me.profile.address,
    address_line: me.profile.address_line,
    region_code: me.profile.region_code,
    province_code: me.profile.province_code,
    city_code: me.profile.city_code,
    barangay_code: me.profile.barangay_code,
  };

  return (
    <div className="flex flex-col gap-6">
      <TransactionDetail {...page.data} autofill={autofill} />
    </div>
  );
}
