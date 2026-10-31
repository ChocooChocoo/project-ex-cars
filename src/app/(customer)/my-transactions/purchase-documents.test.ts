import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, after, autoCheckDocument, removeObject, db } = vi.hoisted(() => {
  // A minimal stand-in for the Supabase query builder: reads answer with the row set for the table,
  // writes are recorded, and deletes drop the row through the admin client.
  const rows: Record<string, unknown> = {};
  const writes: { table: string; op: string; payload?: Record<string, unknown> }[] = [];
  const removed: string[][] = [];
  const from = (table: string) => {
    const answer = () => Promise.resolve({ data: rows[table] ?? null, count: 0, error: null });
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "eq", "neq", "in", "order", "limit"]) builder[step] = () => builder;
    builder.insert = (payload: Record<string, unknown>) => {
      writes.push({ table, op: "insert", payload });
      return builder;
    };
    builder.delete = () => {
      writes.push({ table, op: "delete" });
      return builder;
    };
    builder.maybeSingle = answer;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) => answer().then(resolve);
    return builder;
  };
  const removeObject = vi.fn(async (paths: string[]) => {
    removed.push(paths);
    return { data: paths, error: null };
  });
  return {
    getUser: vi.fn(),
    after: vi.fn(),
    autoCheckDocument: vi.fn(),
    removeObject,
    db: { rows, writes, removed, from },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after }));
vi.mock("@/lib/verification/verify-document", () => ({ autoCheckDocument }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser }, from: db.from })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: db.from, storage: { from: () => ({ remove: removeObject }) } })),
}));

import { removePurchaseDocument, uploadPurchaseDocument } from "./actions";

const buyerId = "11111111-1111-4111-8111-111111111111";
const otherBuyerId = "44444444-4444-4444-8444-444444444444";
const transactionId = "22222222-2222-4222-8222-222222222222";
const documentId = "33333333-3333-4333-8333-333333333333";
const storagePath = `${transactionId}/valid_id-1.jpg`;

function uploadForm(fields: Record<string, string> = {}) {
  const form = new FormData();
  form.set("transaction_id", transactionId);
  form.set("document_kind", "valid_id");
  form.set("id_type", "passport");
  form.set("id_side", "front");
  form.set("storage_path", storagePath);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

const idRow = (idType: string, idSide: string, verificationState = "pending") => ({
  document_kind: "valid_id",
  verification_state: verificationState,
  id_type: idType,
  id_side: idSide,
});

beforeEach(() => {
  vi.clearAllMocks();
  for (const table of Object.keys(db.rows)) delete db.rows[table];
  db.writes.length = 0;
  db.removed.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: buyerId } } });
});

describe("uploadPurchaseDocument ID sides", () => {
  beforeEach(() => {
    db.rows.transactions = { id: transactionId, customer_id: buyerId, transaction_kind: "buy" };
  });

  it("asks which side of the ID the image shows", async () => {
    await expect(uploadPurchaseDocument(uploadForm({ id_side: "" }))).resolves.toEqual({
      error: "Select front or back of the ID.",
    });
    expect(db.writes.filter((write) => write.table === "transaction_documents")).toEqual([]);
  });

  it("records the side on the ID row", async () => {
    await expect(uploadPurchaseDocument(uploadForm({ id_side: "back" }))).resolves.toEqual({ success: true });

    const insert = db.writes.find((write) => write.table === "transaction_documents");
    expect(insert?.payload).toMatchObject({ document_kind: "valid_id", id_type: "passport", id_side: "back" });
  });

  it("runs the ID auto-check on the front only", async () => {
    await expect(uploadPurchaseDocument(uploadForm({ id_side: "front" }))).resolves.toEqual({ success: true });
    expect(after).toHaveBeenCalledTimes(1);

    after.mockClear();
    await expect(uploadPurchaseDocument(uploadForm({ id_side: "back" }))).resolves.toEqual({ success: true });
    expect(after).not.toHaveBeenCalled();
  });

  it("refuses a fifth ID image", async () => {
    db.rows.transaction_documents = [
      idRow("passport", "front"),
      idRow("passport", "back"),
      idRow("drivers_license", "front"),
      idRow("drivers_license", "back"),
    ];

    await expect(uploadPurchaseDocument(uploadForm({ id_type: "umid" }))).resolves.toEqual({
      error: "You can upload four ID images: the front and back of two IDs.",
    });
    expect(db.writes.filter((write) => write.table === "transaction_documents")).toEqual([]);
  });

  it("allows a replacement once a rejected image frees its place", async () => {
    db.rows.transaction_documents = [
      idRow("passport", "front", "rejected"),
      idRow("passport", "back"),
      idRow("drivers_license", "front"),
      idRow("drivers_license", "back"),
    ];

    await expect(uploadPurchaseDocument(uploadForm())).resolves.toEqual({ success: true });
  });

  it("refuses the same side of the same ID twice", async () => {
    db.rows.transaction_documents = [idRow("passport", "front")];

    await expect(uploadPurchaseDocument(uploadForm({ id_side: "front" }))).resolves.toEqual({
      error: "That side of this ID is already uploaded.",
    });
    expect(db.writes.filter((write) => write.table === "transaction_documents")).toEqual([]);
  });
});

describe("removePurchaseDocument", () => {
  const pendingDocument = {
    id: documentId,
    transaction_id: transactionId,
    storage_path: storagePath,
    verification_state: "pending",
  };

  beforeEach(() => {
    db.rows.transaction_documents = pendingDocument;
    db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "pending" };
  });

  it("removes a pending image and its storage object before the request is sent", async () => {
    await expect(removePurchaseDocument(documentId)).resolves.toEqual({ success: true });

    expect(db.removed).toEqual([[storagePath]]);
    expect(db.writes).toContainEqual({ table: "transaction_documents", op: "delete" });
  });

  it("keeps the documents once the request has been sent", async () => {
    db.rows.transactions = { id: transactionId, customer_id: buyerId, current_state: "under_review" };

    await expect(removePurchaseDocument(documentId)).resolves.toEqual({
      error: "This request has already been sent, so its documents can no longer be removed.",
    });
    expect(db.removed).toEqual([]);
    expect(db.writes).toEqual([]);
  });

  it("keeps a document that staff already checked", async () => {
    db.rows.transaction_documents = { ...pendingDocument, verification_state: "verified" };

    await expect(removePurchaseDocument(documentId)).resolves.toEqual({
      error: "Only a document still waiting for verification can be removed.",
    });
    expect(db.removed).toEqual([]);
    expect(db.writes).toEqual([]);
  });

  it("does not let another buyer remove the document", async () => {
    db.rows.transactions = { id: transactionId, customer_id: otherBuyerId, current_state: "pending" };

    await expect(removePurchaseDocument(documentId)).resolves.toEqual({ error: "Document not found." });
    expect(db.removed).toEqual([]);
    expect(db.writes).toEqual([]);
  });
});
