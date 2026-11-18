"use client";

import { useRequireRole } from "@/components/auth/session-provider";
import { PageSkeleton } from "@/components/page-skeleton";
import { browserApi } from "@/lib/api/client";
import { usePageData } from "@/lib/api/use-page-data";
import type { GceRole } from "@/lib/auth/roles";

import { type FieldCaseRow, FieldCasesClient } from "./_components/field-cases-client";

const FIELD_CASE_ROLES: GceRole[] = [
  "ceo",
  "confidential_informant",
  "sales_manager",
  "mechanic",
  "head_accountant",
  // §4 step 7: Head Security rides with the delivery team and sees the cases assigned to them.
  "head_security",
];
const FIELD_CASE_WORKERS = ["ceo", "confidential_informant", "mechanic", "sales_manager"];
const FIELD_CASE_CREATORS = ["ceo", "confidential_informant", "sales_manager", "head_accountant"];

export interface FieldCaseWorker {
  account_id: string;
  role: string;
  full_name: string | null;
}

// list_field_case_workers() returns both worker kinds in one call; the dialog needs
// them split so the Worker Type toggle can swap the option list.
export function splitFieldCaseWorkers(directory: unknown): {
  informants: { id: string; full_name: string | null }[];
  mechanics: { id: string; full_name: string | null }[];
} {
  const workers = (directory as FieldCaseWorker[] | null) ?? [];
  const toOption = (worker: FieldCaseWorker) => ({ id: worker.account_id, full_name: worker.full_name });

  return {
    informants: workers.filter((worker) => worker.role === "confidential_informant").map(toOption),
    mechanics: workers.filter((worker) => worker.role === "mechanic").map(toOption),
  };
}

type FieldCasePickerTransaction = {
  id: string;
  transaction_kind: string;
  current_state: string;
  profiles: { full_name: string | null } | null;
  vehicles: { id: string; make: string; model: string; year: number; stock_code: string } | null;
};

export default function FieldCasesPage() {
  const allowed = useRequireRole(FIELD_CASE_ROLES);
  // Phase 5: Laravel returns the cases this role may read (FieldCasePolicy), the guarded worker directory and
  // the latest 100 transactions and cars for the create dialog.
  const page = usePageData(allowed ? "field-cases" : "field-cases:denied", () =>
    allowed
      ? browserApi<{
          role: string;
          currentUserId: string;
          cases: FieldCaseRow[];
          workers: FieldCaseWorker[];
          transactions: FieldCasePickerTransaction[];
          vehicles: { id: string; make: string; model: string; year: number; stock_code: string }[];
        }>("GET", "/api/v1/staff/field-cases")
      : Promise.resolve(null),
  );
  if (page.error) throw page.error;
  if (!allowed || !page.data) return <PageSkeleton />;
  const { role, currentUserId, cases, transactions, vehicles } = page.data;
  const { informants, mechanics } = splitFieldCaseWorkers(page.data.workers);

  return (
    <div className="flex flex-col gap-4">
      <FieldCasesClient
        cases={cases}
        canUpdate={FIELD_CASE_WORKERS.includes(role)}
        canCreate={FIELD_CASE_CREATORS.includes(role)}
        canAssignMechanic={["confidential_informant", "ceo"].includes(role)}
        informants={informants}
        mechanics={mechanics}
        userRole={role}
        currentUserId={currentUserId}
        transactions={transactions}
        vehicles={vehicles}
      />
    </div>
  );
}
