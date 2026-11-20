"use client";

import { notFound, redirect } from "next/navigation";

import type { ChecklistEntry } from "@/app/(staff)/inspections/_components/checklist-form";
import { PageSkeleton } from "@/components/page-skeleton";
import type { InspectionResultData } from "@/components/transactions/inspection-result";
import { PurchaseFundsCard } from "@/components/transactions/purchase-funds-card";
import { browserApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { usePageData } from "@/lib/api/use-page-data";
import { useRouteParam } from "@/lib/routing/use-route-param";
import type { PapersStatus } from "@/lib/transactions/buy-flow";
import type { SignedTransactionDocument } from "@/lib/transactions/document-media";

import { BuyerMeetupCase } from "./buyer-meetup-case";
import { DeliveryCase } from "./delivery-case";
import { FieldBudgetCard } from "./field-budget-card";
import { FieldExpensesCard } from "./field-expenses-card";
import type { PaperDocumentRow } from "./papers-card";
import { RecoveryCase } from "./recovery-case";
import { SellMeetupCase } from "./sell-meetup-case";

type Row = Record<string, unknown>;
type Money = { budget: Row | null; expenses: (Row & { proof_url: string | null })[] };
type CasePack = {
  kind: "acquisition" | "delivery" | "buyer_meetup" | "recovery";
  role: string;
  userId: string;
  assigned: boolean;
  fieldCase: Row & {
    id: string;
    state: string;
    transaction_id: string;
    assigned_confidential_informant: string | null;
    mechanic_id: string | null;
  };
  transaction: Row & { id: string; current_state?: string };
  handover?: Row | null;
  papers?: PaperDocumentRow[];
  money?: Money;
  mechanics?: { account_id: string; role: string; full_name: string | null }[];
  evidence?: { id: string; url: string }[];
  sellDetails?: Row | null;
  documents?: SignedTransactionDocument[];
  expenses?: Row[];
  /** SH-7: the reported part-by-part inspection and the checklist the Mechanic answers. */
  inspection?: InspectionResultData | null;
  checklist?: ChecklistEntry[];
  fund?: (Row & { requested_by?: string }) | null;
};

const FIELD_TEAM = ["confidential_informant", "mechanic", "head_security"];

/**
 * Phase 5: the field team's case pack, loaded from Laravel, which allows only the case's overseers and its
 * assigned team (others get 403, sent to /unauthorized as before). Renders the same components per case kind.
 */
export function FieldCasePage() {
  const id = useRouteParam("field-cases");
  const page = usePageData(`field-case/${id}`, () =>
    browserApi<CasePack>("GET", `/api/v1/staff/field-cases/${encodeURIComponent(id)}`),
  );
  if (page.error instanceof ApiError && page.error.status === 404) notFound();
  if (page.error instanceof ApiError && page.error.status === 403) redirect("/unauthorized");
  if (page.error) throw page.error;
  if (!page.data) return <PageSkeleton />;
  const { kind, role, userId, assigned, fieldCase, transaction } = page.data;

  if (kind === "recovery") {
    return (
      <RecoveryCase
        fieldCase={fieldCase as unknown as Parameters<typeof RecoveryCase>[0]["fieldCase"]}
        transaction={transaction as unknown as Parameters<typeof RecoveryCase>[0]["transaction"]}
        mechanics={page.data.mechanics ?? []}
        canAct={assigned && FIELD_TEAM.includes(role)}
        isInformant={role === "confidential_informant" && fieldCase.assigned_confidential_informant === userId}
        evidence={(page.data.evidence ?? []).filter((photo) => photo.url)}
      />
    );
  }

  const handover = page.data.handover ?? null;
  const papersStatus = (handover?.papers_status as PapersStatus | null | undefined) ?? null;
  // BH-2: the Confidential Informant handles the contract on a buyer meet-up. The Mechanic's view of the case is the
  // vehicle check only, so no member is passed for a Mechanic and no contract control renders for them.
  const member =
    role === "confidential_informant" && fieldCase.assigned_confidential_informant === userId ? "informant" : null;
  const isInformant = role === "confidential_informant" && fieldCase.assigned_confidential_informant === userId;
  const approved = transaction.current_state === "approved";
  const open = !["completed", "cancelled"].includes(fieldCase.state) && approved;

  if (kind === "buyer_meetup" || kind === "delivery") {
    const money = page.data.money ?? { budget: null, expenses: [] };
    const papers = page.data.papers ?? [];
    const deedHref = `/vehicle-papers/${String(transaction.id)}/deed-of-sale`;
    return (
      <div className="flex flex-col gap-4">
        {kind === "buyer_meetup" ? (
          <BuyerMeetupCase
            fieldCase={fieldCase}
            transaction={transaction}
            papersStatus={papersStatus}
            handover={handover ?? {}}
            member={approved ? member : null}
            canRecordPapers={isInformant && approved}
            papers={papers}
            canUpload={isInformant && open}
            deedHref={deedHref}
          />
        ) : (
          <DeliveryCase
            fieldCase={fieldCase}
            transaction={transaction}
            papersStatus={papersStatus}
            handover={handover ?? {}}
            member={approved ? member : null}
            userRole={role}
            userId={userId}
            papers={papers}
            canUpload={isInformant && open}
            deedHref={deedHref}
          />
        )}
        <FieldBudgetCard
          fieldCaseId={fieldCase.id}
          budget={money.budget}
          expenses={money.expenses}
          isInformant={isInformant}
          open={open}
        />
        <FieldExpensesCard fieldCaseId={fieldCase.id} expenses={money.expenses} canFile={isInformant && open} />
      </div>
    );
  }

  const sell = page.data.sellDetails ?? null;
  const fund = page.data.fund ?? null;
  const expenses = page.data.expenses ?? [];
  const halfway = sell?.meetup_method !== "gce_visit";
  return (
    <div className="flex flex-col gap-4">
      <SellMeetupCase
        fieldCase={fieldCase}
        transaction={transaction}
        sellDetails={sell}
        documents={page.data.documents ?? []}
        expenses={expenses}
        inspection={page.data.inspection ?? null}
        checklist={(page.data.checklist ?? []) as ChecklistEntry[]}
        userRole={role}
        userId={userId}
      />
      {halfway && (isInformant || fund) ? (
        <PurchaseFundsCard
          transactionId={String(fieldCase.transaction_id)}
          fieldCaseId={fieldCase.id}
          fund={fund}
          agreedPrice={Number(sell?.agreed_price ?? 0)}
          halfway
          expenses={expenses}
          canRequest={isInformant && approved}
          isRequester={Boolean(fund && fund.requested_by === userId)}
          cleared={Boolean(sell?.cleared_for_payment_at)}
          vehicle={(transaction.vehicles as Record<string, unknown> | null) ?? null}
          seller={((transaction.profiles as Record<string, unknown> | null)?.full_name as string | null) ?? null}
        />
      ) : null}
    </div>
  );
}
