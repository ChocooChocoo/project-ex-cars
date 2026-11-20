"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type FieldExpenseRow, FieldExpensesCard } from "./_components/field-expenses-card";
import {
  type CashOnHand,
  type DisbursementRow,
  FinanceClient,
  type FinancialEntryRow,
  type PurchaseTransactionRow,
} from "./_components/finance-client";
import { type ReconditioningFundRow, ReconditioningFundsCard } from "./_components/reconditioning-funds-card";
import { type SaleRecordRow, SaleRecordsCard } from "./_components/sale-records-card";

const FINANCE_ROLES: GceRole[] = ["ceo", "head_accountant", "account_manager", "confidential_informant"];

/** SN-10: released funds, returns and verified payments appear on the page within this window, no reload. */
const FINANCE_REFRESH_MS = 30_000;

interface FinanceData {
  role: string;
  entries: FinancialEntryRow[];
  /** SN-10: null for a Confidential Informant, who reads their own requests but not the company's cash. */
  cashOnHand: CashOnHand | null;
  disbursements: DisbursementRow[];
  purchaseTransactions: PurchaseTransactionRow[];
  saleRecords: SaleRecordRow[];
  fieldExpenses: FieldExpenseRow[];
  reconditioningFunds: ReconditioningFundRow[];
}

export default function FinancePage() {
  const allowed = useRequireRole(FINANCE_ROLES);
  // Phase 7: Laravel applies the old row rules (ledger for CEO/HA/AM, own requests for the informant, records,
  // field expenses and reconditioning funds for CEO/HA) and signs the receipt links. SN-10: it also sums Cash on
  // hand and the page polls, so a release made on another screen shows up here without a refresh.
  const page = usePageData(
    allowed ? "finance" : "finance:denied",
    () => (allowed ? browserApi<FinanceData>("GET", "/api/v1/staff/finance") : Promise.resolve(null)),
    { refreshMs: FINANCE_REFRESH_MS },
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const data = page.data;
  const role = data.role;
  const isInformant = role === "confidential_informant";

  return (
    <div className="flex flex-col gap-6">
      <FinanceClient
        entries={data.entries}
        cashOnHand={data.cashOnHand}
        disbursements={data.disbursements}
        purchaseTransactions={data.purchaseTransactions}
        canRecord={!isInformant && ["ceo", "head_accountant", "account_manager"].includes(role)}
        canVerify={!isInformant && ["ceo", "head_accountant"].includes(role)}
        canRequest={["ceo", "account_manager", "confidential_informant"].includes(role)}
        canAdvance={!isInformant && ["ceo", "head_accountant"].includes(role)}
        canConfirmReturn={role === "head_accountant"}
        canRequestPurchaseFunds={!isInformant && ["ceo", "account_manager"].includes(role)}
        isInformant={isInformant}
      />
      {["ceo", "head_accountant"].includes(role) ? <SaleRecordsCard sales={data.saleRecords} /> : null}
      {["ceo", "head_accountant"].includes(role) ? (
        <FieldExpensesCard expenses={data.fieldExpenses} canReimburse={role === "head_accountant"} />
      ) : null}
      {["ceo", "head_accountant"].includes(role) ? (
        <ReconditioningFundsCard requests={data.reconditioningFunds} />
      ) : null}
    </div>
  );
}
