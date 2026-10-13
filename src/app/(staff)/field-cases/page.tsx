import { redirect } from "next/navigation";

import { getCurrentRole } from "@/app/auth/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

import { type FieldCaseRow, FieldCasesClient } from "./_components/field-cases-client";
import { type PapersRequestRow, PapersRequests } from "./_components/papers-requests";

const FIELD_CASE_ROLES = [
  "ceo",
  "confidential_informant",
  "sales_manager",
  "mechanic",
  "account_manager",
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

export default async function FieldCasesPage() {
  const role = await getCurrentRole();
  if (!role || !FIELD_CASE_ROLES.includes(role)) {
    redirect("/unauthorized");
  }

  const supabase = await createServerSupabase();
  const [{ data: cases }, { data: userData }] = await Promise.all([
    supabase.from("field_cases").select("*").order("created_at", { ascending: false }),
    supabase.auth.getUser(),
  ]);
  const currentUserId = userData.user?.id ?? null;

  // Role assignments live in private.user_roles, outside the exposed API schemas, so
  // the worker directory comes from the guarded SECURITY DEFINER function instead of
  // get_all_user_roles() — which raises 'Permission denied' for every role except the
  // CEO and Account Manager, and left this dropdown empty for the other three roles
  // that can create field cases.
  const [{ data: workerDirectory }, { data: transactions }, { data: vehicles }] = await Promise.all([
    supabase.rpc("list_field_case_workers"),
    supabase
      .from("transactions")
      .select("id, transaction_kind, current_state, profiles(full_name), vehicles(id, make, model, year, stock_code)")
      .order("opened_at", { ascending: false })
      .limit(100),
    supabase
      .from("vehicles")
      .select("id, make, model, year, stock_code")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const { informants, mechanics } = splitFieldCaseWorkers(workerDirectory);

  // GCE visit sales waiting for their papers. The Confidential Informant cannot read transactions
  // under RLS, so the list is read with the service role, for that role only.
  let papersRequests: PapersRequestRow[] | null = null;
  if (role === "confidential_informant") {
    const { data: waiting } = await createAdminClient()
      .from("sale_handovers")
      .select("transaction_id, transactions(profiles(full_name), vehicles(make, model, year, stock_code))")
      .eq("papers_status", "requested")
      .order("papers_updated_at", { ascending: true });
    const one = (value: unknown) => (Array.isArray(value) ? value[0] : value) as Record<string, unknown> | null;
    papersRequests = ((waiting as Record<string, unknown>[] | null) ?? []).map((row) => {
      const sale = one(row.transactions);
      const buyer = one(sale?.profiles);
      const car = one(sale?.vehicles);
      return {
        transactionId: row.transaction_id as string,
        buyer: String(buyer?.full_name ?? "the buyer"),
        vehicle: car ? `${car.year} ${car.make} ${car.model} (${car.stock_code})` : "A sold car",
      };
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {papersRequests ? <PapersRequests requests={papersRequests} /> : null}
      <FieldCasesClient
        cases={(cases as unknown as FieldCaseRow[]) ?? []}
        canUpdate={FIELD_CASE_WORKERS.includes(role)}
        canCreate={FIELD_CASE_CREATORS.includes(role)}
        canAssignMechanic={["confidential_informant", "ceo"].includes(role)}
        informants={informants}
        mechanics={mechanics}
        userRole={role}
        currentUserId={currentUserId}
        transactions={
          (transactions as
            | {
                id: string;
                transaction_kind: string;
                current_state: string;
                profiles: { full_name: string | null } | null;
                vehicles: { id: string; make: string; model: string; year: number; stock_code: string } | null;
              }[]
            | null) ?? []
        }
        vehicles={
          (vehicles as { id: string; make: string; model: string; year: number; stock_code: string }[] | null) ?? []
        }
      />
    </div>
  );
}
