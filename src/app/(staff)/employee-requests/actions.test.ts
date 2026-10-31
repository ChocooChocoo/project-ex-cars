import { beforeEach, describe, expect, it, vi } from "vitest";

const { attachmentInsert, createSignedUploadUrl, remove, requestInsert } = vi.hoisted(() => ({
  attachmentInsert: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  remove: vi.fn(),
  requestInsert: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const requestId = "22222222-2222-4222-8222-222222222222";

let requestInsertResult: { data: { id: string } | null; error: { message: string } | null } = {
  data: { id: requestId },
  error: null,
};
let attachmentInsertResult: { error: { message: string } | null } = { error: null };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: vi.fn(async () => "mechanic") }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: vi.fn(),
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } } })) },
    from: vi.fn(() => ({
      insert: (row: unknown) => {
        requestInsert(row);
        return { select: () => ({ single: vi.fn(async () => requestInsertResult) }) };
      },
    })),
  })),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => ({ remove, createSignedUploadUrl }) },
    from: () => ({
      insert: (rows: unknown) => {
        attachmentInsert(rows);
        return Promise.resolve(attachmentInsertResult);
      },
    }),
  }),
}));

import { prepareRequestUploads, submitEmployeeRequest } from "./actions";

function proofForm(proofs: unknown) {
  const formData = new FormData();
  formData.set("request_kind", "leave");
  formData.set("start_date", "2026-11-02");
  formData.set("end_date", "2026-11-03");
  formData.set("leave_reason", "sick");
  if (proofs !== undefined) formData.set("proofs", JSON.stringify(proofs));
  return formData;
}

const proof = {
  path: `${userId}/proof.pdf`,
  name: "proof.pdf",
  type: "application/pdf",
  size: 2048,
};

beforeEach(() => {
  vi.clearAllMocks();
  requestInsertResult = { data: { id: requestId }, error: null };
  attachmentInsertResult = { error: null };
  createSignedUploadUrl.mockImplementation(async (path: string) => ({ data: { path, token: "t" }, error: null }));
});

describe("prepareRequestUploads", () => {
  it("refuses more than three files before touching storage", async () => {
    const files = Array.from({ length: 4 }, (_, index) => ({
      name: `proof-${index}.pdf`,
      type: "application/pdf",
      size: 2048,
    }));

    expect(await prepareRequestUploads(files)).toEqual({ error: "Attach at most 3 files." });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("refuses a file type the bucket does not allow", async () => {
    expect(await prepareRequestUploads([{ name: "run.exe", type: "application/x-msdownload", size: 2048 }])).toEqual({
      error: "Attach a JPG, PNG, WebP image or a PDF.",
    });
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("signs uploads inside the caller's own folder", async () => {
    const result = await prepareRequestUploads([{ name: "proof.pdf", type: "application/pdf", size: 2048 }]);

    expect(result).toEqual({
      uploads: [{ path: expect.stringMatching(new RegExp(`^${userId}/[0-9a-f-]{36}\\.pdf$`)), token: "t" }],
    });
  });
});

describe("submitEmployeeRequest", () => {
  it("saves the leave reason and records the proof files against the new request", async () => {
    const result = await submitEmployeeRequest(proofForm([proof]));

    expect(result).toEqual({ success: true });
    expect(requestInsert).toHaveBeenCalledWith({
      employee_id: userId,
      request_kind: "leave",
      start_date: "2026-11-02",
      end_date: "2026-11-03",
      overtime_hours: null,
      leave_reason: "sick",
      reason: null,
    });
    expect(attachmentInsert).toHaveBeenCalledWith([
      {
        request_id: requestId,
        storage_path: proof.path,
        original_name: "proof.pdf",
        file_kind: "file",
        file_size: 2048,
        uploader_id: userId,
      },
    ]);
  });

  it("saves an overtime request with its hours and no end date", async () => {
    const form = proofForm(undefined);
    form.set("request_kind", "overtime");
    form.set("start_date", "2026-11-02");
    form.set("end_date", "2026-11-09");
    form.set("reason", "Month-end closing");
    form.set("overtime_hours", "2.5");

    const result = await submitEmployeeRequest(form);

    expect(result).toEqual({ success: true });
    expect(requestInsert).toHaveBeenCalledWith({
      employee_id: userId,
      request_kind: "overtime",
      start_date: "2026-11-02",
      end_date: null,
      overtime_hours: 2.5,
      leave_reason: null,
      reason: null,
    });
  });

  it("refuses a proof path outside the caller's folder", async () => {
    const result = await submitEmployeeRequest(
      proofForm([{ ...proof, path: "22222222-2222-4222-8222-222222222222/proof.pdf" }]),
    );

    expect(result).toEqual({ error: "Invalid proof files. Please attach them again." });
    expect(requestInsert).not.toHaveBeenCalled();
    expect(attachmentInsert).not.toHaveBeenCalled();
  });

  it("removes the uploads when the request insert fails", async () => {
    requestInsertResult = { data: null, error: { message: "new row violates row-level security policy" } };

    const result = await submitEmployeeRequest(proofForm([proof]));

    expect(result).toEqual({ error: "new row violates row-level security policy" });
    expect(remove).toHaveBeenCalledWith([proof.path]);
    expect(attachmentInsert).not.toHaveBeenCalled();
  });
});
