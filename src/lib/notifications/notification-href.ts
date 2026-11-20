import { type GceRole, ROLE_NAV_ACCESS } from "@/lib/auth/roles";
import { rolePath } from "@/lib/routing/paths";

type NotificationReference = { reference_table: string | null; reference_id: string | null };

// Where a notification opens (T03 G1). Every reference today points at a transaction, directly or through an
// installment. Field roles without the transaction list (mechanic, head security) open the field case they are
// assigned to on that transaction. Anything else gets no link rather than one that ends in /unauthorized.
export function notificationHref(
  row: NotificationReference,
  role: string | null,
  installmentTransactions: ReadonlyMap<string, string> = new Map(),
  assignedFieldCases: ReadonlyMap<string, string> = new Map(),
): string | null {
  if (!role || !row.reference_id) return null;

  if (row.reference_table === "field_cases") {
    const access = ROLE_NAV_ACCESS[role as GceRole];
    return access === "all" || access?.has("field-cases") ? rolePath(role, `/field-cases/${row.reference_id}`) : null;
  }

  // Notes Part 1: supplier posts open in the supplier's portal or in the staff Supplier Vehicles page.
  if (row.reference_table === "supplier_vehicle_posts") {
    if (role === "supplier") return rolePath(role, `/portal/vehicles?post=${row.reference_id}`);
    const access = ROLE_NAV_ACCESS[role as GceRole];
    return access === "all" || access?.has("supplier-vehicles")
      ? rolePath(role, `/supplier-vehicles?post=${row.reference_id}`)
      : null;
  }
  if (row.reference_table === "supplier_profiles") {
    if (role === "supplier") return rolePath(role, "/portal");
    const access = ROLE_NAV_ACCESS[role as GceRole];
    return access === "all" || access?.has("suppliers") ? rolePath(role, "/suppliers") : null;
  }

  // T06: a price revision request opens the car it is about.
  if (row.reference_table === "vehicles") {
    const access = ROLE_NAV_ACCESS[role as GceRole];
    return access === "all" || access?.has("vehicles") ? rolePath(role, `/vehicles/${row.reference_id}`) : null;
  }

  const transactionId =
    row.reference_table === "transactions"
      ? row.reference_id
      : row.reference_table === "installments"
        ? installmentTransactions.get(row.reference_id)
        : undefined;
  if (!transactionId) return null;

  if (role === "customer") return rolePath(role, `/my-transactions/${transactionId}`);

  const access = ROLE_NAV_ACCESS[role as GceRole];
  if (access && (access === "all" || access.has("transactions"))) {
    return rolePath(role, `/transactions/${transactionId}`);
  }
  const fieldCaseId = assignedFieldCases.get(transactionId);
  if (fieldCaseId && access?.has("field-cases")) return rolePath(role, `/field-cases/${fieldCaseId}`);
  return null;
}
