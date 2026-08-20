import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export type SupplierOverviewSupplier = {
  id: string;
  business_name: string;
  supplier_kind: string;
  state: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  account_id: string | null;
};

export type SupplierOverviewDocument = {
  id: string;
  supplier_id: string;
  document_kind: string;
  is_primary_id: boolean;
  storage_path: string;
  verification_state: string;
  verified_at: string | null;
  created_at: string;
};

export type SupplierVerificationProgress = {
  verifiedPrimary: number;
  required: number;
  total: number;
};

export type SupplierOverviewResult = {
  supplier: SupplierOverviewSupplier | null;
  documents: SupplierOverviewDocument[];
  verification: SupplierVerificationProgress;
};

const REQUIRED_PRIMARY_IDS = 2 as const;

/**
 * Fetch own supplier overview via service role + explicit account_id guard.
 * RLS: "Approved suppliers can read own record" blocks pending self-read,
 * so we bypass RLS with admin client but scope to account_id === auth.uid().
 * No audit log for read (WS-C drill-down audit is separate); no cross-supplier leak.
 * @internal - exported for tests; callers should use getOwnSupplierOverview which enforces auth.
 */
export async function fetchOwnSupplierOverview(accountId: string): Promise<SupplierOverviewResult> {
  const empty: SupplierOverviewResult = {
    supplier: null,
    documents: [],
    verification: { verifiedPrimary: 0, required: REQUIRED_PRIMARY_IDS, total: 0 },
  };
  if (!accountId) return empty;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== accountId) return empty;

  const admin = createAdminClient();
  const { data: supplier } = await admin
    .from("suppliers")
    .select("id,business_name,supplier_kind,state,contact_name,contact_email,contact_phone,created_at,account_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (!supplier) return empty;

  const { data: documents } = await admin
    .from("supplier_documents")
    .select("id,supplier_id,document_kind,is_primary_id,storage_path,verification_state,verified_at,created_at")
    .eq("supplier_id", supplier.id)
    .order("created_at", { ascending: true });

  const docs = (documents ?? []) as SupplierOverviewDocument[];
  const verifiedPrimary = docs.filter((d) => d.is_primary_id && d.verification_state === "verified").length;

  return {
    supplier: supplier as SupplierOverviewSupplier,
    documents: docs,
    verification: { verifiedPrimary, required: REQUIRED_PRIMARY_IDS, total: docs.length },
  };
}

export async function getOwnSupplierOverview(): Promise<SupplierOverviewResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      supplier: null,
      documents: [],
      verification: { verifiedPrimary: 0, required: REQUIRED_PRIMARY_IDS, total: 0 },
    };
  }
  return fetchOwnSupplierOverview(user.id);
}
