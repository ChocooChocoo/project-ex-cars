import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authGetUser,
  from,
  getCurrentRole,
  logAuditEvent,
  storageUpload,
  storageRemove,
  documentInsert,
  documentUpdate,
  documentSelect,
  transactionSelect,
  transactionEq,
  purchaseDetailsUpdate,
} = vi.hoisted(() => {
  const authGetUser = vi.fn();
  const from = vi.fn();
  const getCurrentRole = vi.fn();
  const logAuditEvent = vi.fn();
  const storageUpload = vi.fn();
  const storageRemove = vi.fn();
  const documentInsert = vi.fn();
  const documentUpdate = vi.fn();
  const documentSelect = vi.fn();
  const transactionSelect = vi.fn();
  const transactionEq = vi.fn();
  const purchaseDetailsUpdate = vi.fn();
  return {
    authGetUser,
    from,
    getCurrentRole,
    logAuditEvent,
    storageUpload,
    storageRemove,
    documentInsert,
    documentUpdate,
    documentSelect,
    transactionSelect,
    transactionEq,
    purchaseDetailsUpdate,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole }));
vi.mock("@/lib/auth/audit", () => ({ logAuditEvent }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
    from,
    storage: { from: vi.fn(() => ({ upload: storageUpload, remove: storageRemove })) },
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn(() => ({ from })) }));

import { recordPaperwork, verifyTransactionDocument } from "./actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";

function paperworkForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("document_kind", "invoice");
  for (const [key, value] of Object.entries(overrides)) form.set(key, value);
  return form;
}

function verificationForm(decision: string) {
  const form = new FormData();
  form.set("document_id", documentId);
  form.set("decision", decision);
  return form;
}

/** Re-points the transactions lookup at a transaction of the given kind. */
function transactionLookupReturns(kind: string) {
  transactionEq.mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: transactionId, transaction_kind: kind }, error: null }),
  });
}

const documentCountResults: (() => Promise<{ count: number; error: null }>)[] = [];

/** `transaction_documents` count queries, queued in the order the action issues them. */
function documentCountsReturns(...counts: number[]) {
  documentCountResults.length = 0;
  for (const count of counts) documentCountResults.push(() => Promise.resolve({ count, error: null }));
}

function nextDocumentCount() {
  return documentCountResults.shift() ?? (() => Promise.resolve({ count: 0, error: null }));
}

function pendingDocumentLookup(documentKind: string) {
  const documentMaybeSingle = vi.fn().mockResolvedValue({
    data: {
      id: documentId,
      transaction_id: transactionId,
      document_kind: documentKind,
      verification_state: "pending",
    },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle: documentMaybeSingle });
  // Count queries come back as `select(..., { head: true }).eq().eq()/.in().eq()`.
  const countQuery = () => ({
    eq: vi.fn().mockReturnValue({ eq: () => ({ eq: nextDocumentCount() }), in: () => ({ eq: nextDocumentCount() }) }),
  });
  documentSelect.mockImplementation((_columns: string, options?: { head?: boolean }) =>
    options?.head ? countQuery() : { eq },
  );
  return documentMaybeSingle;
}

describe("Task 33 transaction paperwork actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    getCurrentRole.mockResolvedValue("head_accountant");
    logAuditEvent.mockResolvedValue(undefined);
    storageUpload.mockResolvedValue({ error: null });
    storageRemove.mockResolvedValue({ error: null });
    documentInsert.mockResolvedValue({ error: null });
    documentUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    documentSelect.mockReturnValue({ eq: transactionSelect });
    transactionSelect.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: transactionId, transaction_kind: "buy" }, error: null }),
    });
    transactionEq.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: transactionId, transaction_kind: "buy" }, error: null }),
    });
    purchaseDetailsUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    from.mockImplementation((table: string) => {
      if (table === "transaction_documents")
        return { insert: documentInsert, select: documentSelect, update: documentUpdate };
      if (table === "purchase_details") return { update: purchaseDetailsUpdate };
      if (table === "transactions") return { select: vi.fn().mockReturnValue({ eq: transactionEq }) };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it("allows Head Accountant to upload proof-of-billing paperwork", async () => {
    const form = paperworkForm({ document_kind: "proof_of_billing" });
    const file = new File(["contents"], "billing.pdf", { type: "application/pdf" });
    form.set("file", file);

    await expect(recordPaperwork(form)).resolves.toEqual({ success: true });
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${transactionId}/proof_of_billing-`)),
      file,
    );
    expect(documentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_id: transactionId,
        document_kind: "proof_of_billing",
        storage_path: expect.stringMatching(new RegExp(`^${transactionId}/proof_of_billing-`)),
        uploader_id: userId,
        verification_state: "pending",
      }),
    );
  });

  it("rejects paperwork with an invalid transaction id before upload", async () => {
    const form = paperworkForm({ transaction_id: "not-a-uuid" });
    form.set("file", new File(["contents"], "invoice.pdf", { type: "application/pdf" }));

    await expect(recordPaperwork(form)).resolves.toEqual({ error: expect.stringMatching(/invalid|transaction/i) });
    expect(storageUpload).not.toHaveBeenCalled();
  });

  it("rejects prerequisite paperwork for a non-buy transaction before upload", async () => {
    transactionLookupReturns("sell");
    const form = paperworkForm({ document_kind: "valid_id" });
    form.set("file", new File(["contents"], "id.jpg", { type: "image/jpeg" }));

    await expect(recordPaperwork(form)).resolves.toEqual({
      error: "Valid IDs and proof of billing can only be recorded for purchases.",
    });
    expect(storageUpload).not.toHaveBeenCalled();
    expect(documentInsert).not.toHaveBeenCalled();
  });

  it("still accepts non-prerequisite paperwork on a sell transaction", async () => {
    transactionLookupReturns("sell");
    const form = paperworkForm({ document_kind: "invoice" });

    await expect(recordPaperwork(form)).resolves.toEqual({ success: true });
    expect(documentInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_id: transactionId,
        document_kind: "invoice",
        verification_state: "verified",
      }),
    );
  });

  it("removes the uploaded object when the document insert fails", async () => {
    documentInsert.mockResolvedValue({ error: { message: "new row violates row-level security policy" } });
    const form = paperworkForm({ document_kind: "proof_of_billing" });
    form.set("file", new File(["contents"], "billing.pdf", { type: "application/pdf" }));

    await expect(recordPaperwork(form)).resolves.toEqual({
      error: "new row violates row-level security policy",
    });
    expect(storageRemove).toHaveBeenCalledWith([
      expect.stringMatching(new RegExp(`^${transactionId}/proof_of_billing-`)),
    ]);
  });

  it("recomputes a rejected document state after proof of billing is rejected", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    pendingDocumentLookup("proof_of_billing");
    documentUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    documentCountsReturns(2, 0, 1);

    await expect(verifyTransactionDocument(verificationForm("rejected"))).resolves.toEqual({ success: true });
    expect(purchaseDetailsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ document_check_state: "rejected", checked_by: userId }),
    );
  });

  it("marks the aggregate document check verified when the proof of billing is verified last", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    pendingDocumentLookup("proof_of_billing");
    documentCountsReturns(2, 1, 0);

    await expect(verifyTransactionDocument(verificationForm("verified"))).resolves.toEqual({ success: true });
    expect(purchaseDetailsUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ document_check_state: "verified", checked_by: userId }),
    );
  });

  it.each([
    "ceo",
    "sales_manager",
    "account_manager",
  ])("rejects document verification for the %s role", async (role) => {
    getCurrentRole.mockResolvedValue(role);

    await expect(verifyTransactionDocument(verificationForm("verified"))).resolves.toEqual({
      error: "Not authorized to verify purchase documents",
    });
    expect(documentUpdate).not.toHaveBeenCalled();
    expect(purchaseDetailsUpdate).not.toHaveBeenCalled();
  });
});
