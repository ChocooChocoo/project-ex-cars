import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const insert = vi.fn();
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update, insert }));
const getUser = vi.fn(async () => ({ data: { user: { id: "33333333-3333-4333-8333-333333333333" } }, error: null }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/auth/actions", () => ({ getCurrentRole: vi.fn(async () => "account_manager") }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ rpc, from, auth: { getUser } })),
}));

import { saveStaffRecord, setAccountState, submitPerformanceReview, updatePerformanceReview } from "./actions";

const employeeId = "11111111-1111-4111-8111-111111111111";

function saveForm() {
  const form = new FormData();
  form.set("accountId", employeeId);
  form.set("fullName", "Ada Staff");
  form.set("phone", "09170000000");
  form.set("address", "Manila");
  form.set("workdays", "1,2,3,4,5");
  form.set("startTime", "08:00");
  form.set("endTime", "17:00");
  form.set("graceMinutes", "10");
  return form;
}

function stateForm() {
  const form = new FormData();
  form.set("accountId", employeeId);
  form.set("state", "suspended");
  return form;
}

describe("staff RPC action response validation", () => {
  beforeEach(() => rpc.mockReset());

  it("rejects a malformed save payload instead of returning success", async () => {
    rpc.mockResolvedValue({
      data: { profile: { id: "not-a-uuid", account_state: "active" }, schedule: null },
      error: null,
    });

    await expect(saveStaffRecord(saveForm())).resolves.toEqual({ error: "Staff record returned invalid shape." });
  });

  it("rejects a malformed schedule payload instead of returning success", async () => {
    rpc.mockResolvedValue({
      data: {
        profile: {
          id: employeeId,
          account_state: "active",
          full_name: "Ada Staff",
          phone: "09170000000",
          address: "Manila",
        },
        schedule: { id: "55555555-5555-4555-8555-555555555555", timezone: "Asia/Manila" },
      },
      error: null,
    });

    await expect(saveStaffRecord(saveForm())).resolves.toEqual({ error: "Staff record returned invalid shape." });
  });

  it("returns a structurally valid saved profile and schedule", async () => {
    rpc.mockResolvedValue({
      data: {
        profile: {
          id: employeeId,
          account_state: "active",
          full_name: "Ada Staff",
          phone: "09170000000",
          address: "Manila",
        },
        schedule: {
          id: "55555555-5555-4555-8555-555555555555",
          employee_id: employeeId,
          workdays: [1, 2, 3, 4, 5],
          start_time: "08:00:00",
          end_time: "17:00:00",
          grace_minutes: 10,
          timezone: "Asia/Manila",
        },
      },
      error: null,
    });

    const result = await saveStaffRecord(saveForm());
    expect(result).toMatchObject({ success: true, row: { id: employeeId }, schedule: { timezone: "Asia/Manila" } });
  });

  it("rejects a schedule returned for a different account", async () => {
    rpc.mockResolvedValue({
      data: {
        profile: {
          id: employeeId,
          account_state: "active",
          full_name: "Ada Staff",
          phone: "09170000000",
          address: "Manila",
        },
        schedule: {
          id: "55555555-5555-4555-8555-555555555555",
          employee_id: "22222222-2222-4222-8222-222222222222",
          workdays: [1, 2, 3, 4, 5],
          start_time: "08:00:00",
          end_time: "17:00:00",
          grace_minutes: 10,
          timezone: "Asia/Manila",
        },
      },
      error: null,
    });

    await expect(saveStaffRecord(saveForm())).resolves.toEqual({ error: "Staff record returned invalid shape." });
  });

  it("rejects a malformed account-state payload instead of returning success", async () => {
    rpc.mockResolvedValue({ data: { id: employeeId, account_state: "not-a-state" }, error: null });

    await expect(setAccountState(stateForm())).resolves.toEqual({ error: "Account state returned invalid shape." });
  });
});

describe("performance review actions", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
    update.mockReset();
    update.mockReturnValue({ eq });
    eq.mockReset();
    eq.mockResolvedValue({ error: null });
  });

  const reviewId = "44444444-4444-4444-8444-444444444444";

  function reviewForm(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set("review_id", reviewId);
    form.set("employee_id", employeeId);
    form.set("review_period_start", "2026-05-11");
    form.set("review_period_end", "2026-07-10");
    form.set("rating", "4");
    form.set("strengths", "Good");
    for (const [key, value] of Object.entries(overrides)) form.set(key, value);
    return form;
  }

  it("submits a new performance review", async () => {
    const result = await submitPerformanceReview(reviewForm());
    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ employee_id: employeeId, rating: 4, status: "submitted" }),
    );
  });

  it("updates an existing performance review by id", async () => {
    const result = await updatePerformanceReview(reviewForm());
    expect(result).toEqual({ success: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ employee_id: employeeId, rating: 4 }));
    expect(eq).toHaveBeenCalledWith("id", reviewId);
  });

  it("rejects an update without a review id", async () => {
    const form = reviewForm();
    form.delete("review_id");
    await expect(updatePerformanceReview(form)).resolves.toEqual({
      error: expect.stringMatching(/invalid/i),
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("surfaces a database error from an update", async () => {
    eq.mockResolvedValue({ error: { message: "db exploded" } });
    await expect(updatePerformanceReview(reviewForm())).resolves.toEqual({ error: "db exploded" });
  });
});
