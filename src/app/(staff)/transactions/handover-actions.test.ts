import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, getCurrentRole, notify, db, storage } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: every read of a table answers with the row
  // set for it, and every write is recorded.
  const rows: Record<string, unknown> = {};
  const errors: Record<string, { message: string } | undefined> = {};
  const writes: { table: string; op: string; payload: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, error: errors[table] ?? null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit", "not"]) builder[step] = () => builder;
    for (const op of ["insert", "upsert", "update"]) {
      builder[op] = (payload: Record<string, unknown>) => {
        writes.push({ table, op, payload });
        return builder;
      };
    }
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  const storage = { upload: vi.fn(), remove: vi.fn(), createSignedUrl: vi.fn() };
  return {
    getUser: vi.fn(),
    getCurrentRole: vi.fn(),
    notify: vi.fn(),
    db: { rows, errors, writes, from },
    storage,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/server-session", () => ({ getCurrentRole }));
vi.mock("@/lib/notifications/notify", () => ({ notify }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: db.from,
    storage: { from: () => storage },
  })),
}));

import {
  approvePapersRelease,
  handPapersToBuyer,
  receivePapers,
  recordBuyerMet,
  recordContractCopy,
  recordFieldSignatures,
  releasePapersToCi,
  reportSigning,
  requestPapersRelease,
  reviewContract,
  saveContract,
  uploadFieldDocument,
} from "./handover-actions";

const userId = "11111111-1111-4111-8111-111111111111";
const transactionId = "22222222-2222-4222-8222-222222222222";
const CI_ONLY = "Only the Confidential Informant handles the vehicle papers.";

const at = "2026-10-14T02:00:00.000Z";

function form(fields: Record<string, string | File> = {}) {
  const fd = new FormData();
  fd.set("transaction_id", transactionId);
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

const handover = (row: Record<string, unknown> | null) => {
  db.rows.sale_handovers = row;
};

function sale(arrangement: string, overrides: Record<string, unknown> = {}) {
  db.rows.transactions = {
    id: transactionId,
    customer_id: "buyer-1",
    current_state: "approved",
    transaction_kind: "buy",
    purchase_details: { arrangement_kind: arrangement, payment_method: "cash", final_price: 500000 },
    payment_records: [{ payment_kind: "full", amount: 500000, verified_by: "accountant-1" }],
    ...overrides,
  };
}

const papers = (status: string | null) => {
  db.rows.sale_handovers = status ? { papers_status: status } : null;
};

const papersWrite = () => db.writes.find((write) => write.table === "sale_handovers")?.payload;

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  for (const table of Object.keys(db.errors)) delete db.errors[table];
  db.writes.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: userId } } });
  getCurrentRole.mockResolvedValue("sales_manager");
  db.rows.field_cases = { id: "case-1", assigned_confidential_informant: userId };
  storage.upload.mockResolvedValue({ error: null });
  storage.remove.mockResolvedValue({ error: null });
  storage.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://example.test/doc" }, error: null });
});

describe("papers release at a GCE visit", () => {
  it("lets the Sales Manager request the papers once the payment is checked", async () => {
    sale("gce_visit");

    await expect(requestPapersRelease(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ transaction_id: transactionId, papers_status: "requested" });
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "confidential_informant" }, expect.anything());
  });

  it("refuses the request before the Head Accountant has checked the payment", async () => {
    sale("gce_visit", { payment_records: [{ verified_by: null }] });

    await expect(requestPapersRelease(form())).resolves.toEqual({
      error: "The Head Accountant must check the payment before the papers are requested.",
    });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a second request while one is open", async () => {
    sale("gce_visit");
    papers("requested");

    await expect(requestPapersRelease(form())).resolves.toEqual({ error: "The papers were already requested." });
  });

  it("sends a meet-up or delivery to the field case instead", async () => {
    sale("delivery");

    await expect(requestPapersRelease(form())).resolves.toEqual({
      error: "For a meet-up or a delivery, the Confidential Informant releases the papers on the field case.",
    });
  });

  it("lets only the Confidential Informant approve and hand the papers over", async () => {
    sale("gce_visit");
    papers("requested");

    await expect(approvePapersRelease(form())).resolves.toEqual({ error: CI_ONLY });

    getCurrentRole.mockResolvedValue("confidential_informant");
    await expect(approvePapersRelease(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "handed_over", papers_ci_id: userId });
  });

  it("refuses an approval nobody asked for", async () => {
    getCurrentRole.mockResolvedValue("confidential_informant");
    sale("gce_visit");
    papers(null);

    await expect(approvePapersRelease(form())).resolves.toEqual({ error: "No papers release is waiting." });
  });

  it("lets the Sales Manager receive the papers only after the CI handed them over", async () => {
    sale("gce_visit");
    papers("requested");
    await expect(receivePapers(form())).resolves.toEqual({
      error: "The Confidential Informant has not handed the papers over yet.",
    });

    papers("handed_over");
    await expect(receivePapers(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "received" });
  });
});

describe("papers at a meet-up or delivery", () => {
  beforeEach(() => getCurrentRole.mockResolvedValue("confidential_informant"));

  it.each(["mechanic", "head_security", "sales_manager"])("refuses the %s", async (role) => {
    getCurrentRole.mockResolvedValue(role);
    sale("delivery");

    await expect(releasePapersToCi(form())).resolves.toEqual({ error: CI_ONLY });
    await expect(handPapersToBuyer(form())).resolves.toEqual({ error: CI_ONLY });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a Confidential Informant who is not assigned to the field case", async () => {
    sale("meetup");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "someone-else" };

    await expect(releasePapersToCi(form())).resolves.toEqual({
      error: "Only the Confidential Informant assigned to this field case can do this.",
    });
  });

  it("records the release under the assigned Confidential Informant", async () => {
    sale("delivery");

    await expect(releasePapersToCi(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "released_to_ci", papers_ci_id: userId });
  });

  it("hands the papers to the buyer only after they were released", async () => {
    sale("meetup");
    papers(null);
    await expect(handPapersToBuyer(form())).resolves.toEqual({ error: "Record the papers as released first." });

    handover({ papers_status: "released_to_ci", contract_state: "signed" });
    await expect(handPapersToBuyer(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ papers_status: "handed_over" });
  });

  it("refuses to hand the papers over before the contract is signed", async () => {
    sale("delivery");
    handover({ papers_status: "released_to_ci" });

    await expect(handPapersToBuyer(form())).resolves.toEqual({
      error: "The buyer must sign the contract before the papers are handed over.",
    });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses to hand the papers over before the full payment is verified (T10)", async () => {
    sale("delivery", {
      payment_records: [{ payment_kind: "downpayment", amount: 100000, verified_by: "accountant-1" }],
    });
    handover({ papers_status: "released_to_ci", contract_state: "signed" });

    await expect(handPapersToBuyer(form())).resolves.toEqual({
      error: "Wait for the Head Accountant to verify the buyer's full payment before handing over the papers.",
    });
  });

  it("asks for no cash report on a financed sale", async () => {
    sale("delivery", { purchase_details: { arrangement_kind: "delivery", payment_method: "financing" } });
    handover({ papers_status: "released_to_ci", contract_state: "signed" });

    await expect(handPapersToBuyer(form())).resolves.toEqual({ success: true });
  });
});

describe("contract written, approved and returned", () => {
  const financed = (arrangement = "gce_visit") =>
    sale(arrangement, { purchase_details: { arrangement_kind: arrangement, payment_method: "financing" } });

  it("saves the Sales Manager's draft", async () => {
    financed();

    await expect(saveContract(form({ body: "Terms of sale." }))).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({
      contract_body: "Terms of sale.",
      contract_state: "draft",
      contract_written_by: userId,
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it("sends the contract to the Head Accountant", async () => {
    financed("meetup");

    await expect(saveContract(form({ body: "Terms of sale.", submit: "1" }))).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ contract_state: "pending_approval" });
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "head_accountant" }, expect.anything());
  });

  it("refuses an empty contract, another role, and a contract that is already with the Head Accountant", async () => {
    financed();
    await expect(saveContract(form({ body: "  " }))).resolves.toEqual({ error: "Write the contract first." });

    handover({ contract_state: "pending_approval" });
    await expect(saveContract(form({ body: "New terms." }))).resolves.toEqual({
      error: "The contract can no longer be changed.",
    });

    getCurrentRole.mockResolvedValue("head_accountant");
    handover(null);
    await expect(saveContract(form({ body: "Terms." }))).resolves.toEqual({
      error: "Only the Sales Manager writes the contract.",
    });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a contract in the app where the buyer signs on paper", async () => {
    sale("meetup");

    await expect(saveContract(form({ body: "Terms." }))).resolves.toEqual({
      error: "This contract is signed on paper at the meet-up or on delivery.",
    });
  });

  it("lets only the Head Accountant approve a contract that is waiting", async () => {
    financed();
    handover({ contract_state: "pending_approval" });
    await expect(reviewContract(form({ decision: "approve" }))).resolves.toEqual({
      error: "Only the Head Accountant reviews the contract.",
    });

    getCurrentRole.mockResolvedValue("head_accountant");
    await expect(reviewContract(form({ decision: "approve" }))).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ contract_state: "approved", contract_approved_by: userId });
    expect(notify).toHaveBeenCalledWith(expect.anything(), { userId: "buyer-1" }, expect.anything());
  });

  it("returns a contract only with a reason, and tells the Sales Manager", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    financed();
    handover({ contract_state: "pending_approval" });
    await expect(reviewContract(form({ decision: "return" }))).resolves.toEqual({
      error: "Give the reason for returning the contract.",
    });

    await expect(reviewContract(form({ decision: "return", reason: "Wrong term length." }))).resolves.toEqual({
      success: true,
    });
    expect(papersWrite()).toMatchObject({ contract_state: "returned", contract_returned_reason: "Wrong term length." });
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "sales_manager" }, expect.anything());
  });

  it("refuses a review when no contract is waiting", async () => {
    getCurrentRole.mockResolvedValue("head_accountant");
    financed();
    handover({ contract_state: "draft" });

    await expect(reviewContract(form({ decision: "approve" }))).resolves.toEqual({
      error: "No contract is waiting for approval.",
    });
  });
});

describe("contract in the field", () => {
  beforeEach(() => getCurrentRole.mockResolvedValue("confidential_informant"));

  it("lets the assigned Mechanic record Buyer Met, and nobody outside the team", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    sale("meetup");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "ci-1", mechanic_id: "someone-else" };
    await expect(recordBuyerMet(form())).resolves.toEqual({
      error: "Only the team assigned to this field case can do this.",
    });

    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "ci-1", mechanic_id: userId };
    await expect(recordBuyerMet(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ buyer_met_at: expect.any(String) });
  });

  it("refuses the signing report before Buyer Met", async () => {
    sale("meetup");

    await expect(reportSigning(form())).resolves.toEqual({ error: "Record Buyer Met first." });
    expect(papersWrite()).toBeUndefined();
  });

  it("marks a contract signed on paper and tells the Sales Manager and the Head Accountant", async () => {
    sale("delivery");
    handover({ buyer_met_at: at });

    await expect(reportSigning(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({
      contract_state: "signed",
      contract_signed_at: expect.any(String),
      signing_reported_at: expect.any(String),
    });
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      { role: "sales_manager" },
      expect.objectContaining({ body: "The buyer has signed the contract." }),
    );
    expect(notify).toHaveBeenCalledWith(expect.anything(), { role: "head_accountant" }, expect.anything());
  });

  it("waits for the buyer's signature in the app on a financed meet-up", async () => {
    sale("meetup", { purchase_details: { arrangement_kind: "meetup", payment_method: "financing" } });
    handover({ buyer_met_at: at, contract_state: "approved" });
    await expect(reportSigning(form())).resolves.toEqual({
      error: "The buyer has not signed the contract in the app yet.",
    });

    handover({ buyer_met_at: at, contract_state: "signed", contract_signed_at: at });
    await expect(reportSigning(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).not.toHaveProperty("contract_signed_at");
  });

  it("lets only the assigned Confidential Informant report the signing", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    sale("meetup");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "ci-1", mechanic_id: userId };
    handover({ buyer_met_at: at });

    await expect(reportSigning(form())).resolves.toEqual({
      error: "Only the assigned Confidential Informant reports the signing.",
    });
  });

  it("records a kept copy only once the contract is signed", async () => {
    sale("meetup");
    handover({ buyer_met_at: at });

    await expect(recordContractCopy(form())).resolves.toEqual({ error: "The contract is not signed yet." });
  });

  it("tells the Sales Manager who has not recorded a copy yet", async () => {
    sale("meetup");
    handover({ contract_state: "signed" });

    await expect(recordContractCopy(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ ci_copy_at: expect.any(String) });
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      { role: "sales_manager" },
      expect.objectContaining({ body: expect.stringContaining("Mechanic") }),
    );
  });

  it("records the Mechanic's copy under the Mechanic", async () => {
    getCurrentRole.mockResolvedValue("mechanic");
    sale("meetup");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "ci-1", mechanic_id: userId };
    handover({ contract_state: "signed", ci_copy_at: at });

    await expect(recordContractCopy(form())).resolves.toEqual({ success: true });
    expect(papersWrite()).toMatchObject({ mechanic_copy_at: expect.any(String) });
    expect(papersWrite()).not.toHaveProperty("ci_copy_at");
    expect(notify).not.toHaveBeenCalled();
  });
});

function file(name = "orcr.pdf", type = "application/pdf", size = 6) {
  return new File([new Uint8Array(size)], name, { type });
}

function documentForm(fields: { kind?: string; note?: string; file?: File } = {}) {
  const fd = form({ document_kind: fields.kind ?? "orcr", note: fields.note ?? "" });
  if (fields.file !== undefined) fd.set("file", fields.file);
  return fd;
}

describe("documents the CI adds at a field case", () => {
  beforeEach(() => getCurrentRole.mockResolvedValue("confidential_informant"));

  it("uploads the paper into the transaction folder and records it as pending", async () => {
    sale("delivery");

    await expect(
      uploadFieldDocument(documentForm({ kind: "official_receipt", note: "OR from the first owner", file: file() })),
    ).resolves.toEqual({ success: true });

    const [path, uploaded] = storage.upload.mock.calls[0] as [string, File];
    expect(path.startsWith(`${transactionId}/ci-doc-`)).toBe(true);
    expect(path.endsWith(".pdf")).toBe(true);
    expect(uploaded.size).toBe(6);
    expect(db.writes.find((write) => write.table === "transaction_documents")?.payload).toMatchObject({
      transaction_id: transactionId,
      document_kind: "official_receipt",
      storage_path: path,
      uploader_id: userId,
      verification_state: "pending",
      note: "OR from the first owner",
    });
    expect(db.writes.some((write) => write.table === "transaction_status_history")).toBe(true);
  });

  it("names the file by its real extension and accepts a photo", async () => {
    sale("delivery");

    await expect(uploadFieldDocument(documentForm({ file: file("photo.png", "image/png") }))).resolves.toEqual({
      success: true,
    });
    expect((storage.upload.mock.calls[0] as [string])[0].endsWith(".png")).toBe(true);
  });

  it("refuses a document the CI cannot file", async () => {
    sale("delivery");

    await expect(uploadFieldDocument(documentForm({ kind: "inspection_photo", file: file() }))).resolves.toEqual({
      error: expect.stringContaining("Invalid option"),
    });
    await expect(uploadFieldDocument(documentForm())).resolves.toEqual({ error: "Attach the document." });
    await expect(uploadFieldDocument(documentForm({ file: file("notes.txt", "text/plain") }))).resolves.toEqual({
      error: "Documents must be a JPEG, PNG, WebP image or a PDF.",
    });
    await expect(
      uploadFieldDocument(documentForm({ file: file("big.pdf", "application/pdf", 2 * 1024 * 1024 + 1) })),
    ).resolves.toEqual({ error: "The document must be 2 MB or smaller." });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("removes the uploaded object when the document row cannot be written", async () => {
    sale("delivery");
    db.errors.transaction_documents = { message: "permission denied" };

    await expect(uploadFieldDocument(documentForm({ file: file() }))).resolves.toEqual({ error: "permission denied" });
    expect(storage.remove).toHaveBeenCalledWith([expect.stringContaining(`${transactionId}/ci-doc-`)]);
  });

  it("refuses a role that does not carry the papers, and a CI who is not assigned", async () => {
    sale("delivery");
    getCurrentRole.mockResolvedValue("mechanic");
    await expect(uploadFieldDocument(documentForm({ file: file() }))).resolves.toEqual({ error: CI_ONLY });

    getCurrentRole.mockResolvedValue("confidential_informant");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "someone-else" };
    await expect(uploadFieldDocument(documentForm({ file: file() }))).resolves.toEqual({
      error: "Only the Confidential Informant assigned to this field case can do this.",
    });
    expect(storage.upload).not.toHaveBeenCalled();
  });
});

describe("contract signed in the field", () => {
  // T11: both PNGs travel in the form and the server stores them (the CI has no upload policy on the bucket).
  const pngFile = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
  const signed = () =>
    form({ buyer_signature: pngFile("signature-buyer.png"), ci_signature: pngFile("signature-ci.png") });

  beforeEach(() => getCurrentRole.mockResolvedValue("confidential_informant"));

  it("uploads both signatures and records an in-app signing", async () => {
    sale("delivery");

    await expect(recordFieldSignatures(signed())).resolves.toEqual({ success: true });
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(papersWrite()).toMatchObject({
      signature_path: expect.stringMatching(new RegExp(`^${transactionId}/signature-buyer-\\d+\\.png$`)),
      ci_signature_path: expect.stringMatching(new RegExp(`^${transactionId}/signature-ci-\\d+\\.png$`)),
      contract_state: "signed",
      contract_signed_at: expect.any(String),
      signing_method: "in_app",
    });
    expect(notify).toHaveBeenCalledWith(
      expect.anything(),
      { role: "sales_manager" },
      expect.objectContaining({ kind: "contract_signed", title: "Contract signed in the field" }),
    );
  });

  it("asks for both signatures", async () => {
    sale("delivery");

    await expect(recordFieldSignatures(form({ buyer_signature: pngFile("buyer.png") }))).resolves.toEqual({
      error: "Draw both signatures.",
    });
    // An empty blob is not a signature.
    const empty = new File([], "empty.png", { type: "image/png" });
    await expect(
      recordFieldSignatures(form({ buyer_signature: empty, ci_signature: pngFile("ci.png") })),
    ).resolves.toEqual({ error: "Draw both signatures." });
    // Only PNG is accepted.
    await expect(
      recordFieldSignatures(
        form({
          buyer_signature: new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }),
          ci_signature: pngFile("ci.png"),
        }),
      ),
    ).resolves.toEqual({ error: "The signatures must be PNG images." });
    expect(papersWrite()).toBeUndefined();
  });

  it("refuses a role that does not sign, and a CI who is not assigned", async () => {
    sale("delivery");
    getCurrentRole.mockResolvedValue("mechanic");
    await expect(recordFieldSignatures(signed())).resolves.toEqual({ error: CI_ONLY });

    getCurrentRole.mockResolvedValue("confidential_informant");
    db.rows.field_cases = { id: "case-1", assigned_confidential_informant: "someone-else" };
    await expect(recordFieldSignatures(signed())).resolves.toEqual({
      error: "Only the Confidential Informant assigned to this field case can do this.",
    });
    expect(papersWrite()).toBeUndefined();
  });
});
