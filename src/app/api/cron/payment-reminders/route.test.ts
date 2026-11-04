import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, sendEmail } = vi.hoisted(() => {
  const state = { installments: [] as unknown[], claimed: new Set<string>(), notifications: [] as unknown[] };
  const from = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const step of ["select", "in", "not", "eq"]) builder[step] = () => builder;
    builder.maybeSingle = () => Promise.resolve({ data: { full_name: "Maria" } });
    builder.upsert = (row: { installment_id: string; days_before: number }) => {
      const key = `${row.installment_id}:${row.days_before}`;
      const fresh = !state.claimed.has(key);
      state.claimed.add(key);
      return { select: () => Promise.resolve({ data: fresh ? [row] : [] }) };
    };
    builder.insert = (row: unknown) => {
      state.notifications.push(row);
      return Promise.resolve({ error: null });
    };
    builder.delete = () => builder;
    // biome-ignore lint/suspicious/noThenProperty: the Supabase builder is awaited directly.
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: table === "installments" ? state.installments : null, error: null });
    return builder;
  };
  const admin = {
    from,
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: "maria@example.com" } } }) } },
  };
  return { db: { state, admin }, sendEmail: vi.fn() };
});

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db.admin }));
vi.mock("@/lib/email/send", () => ({ sendEmail }));

import { reminderDueDates } from "@/lib/payments/reminders";

import { GET } from "./route";

const call = (auth?: string) =>
  GET(new Request("http://localhost/api/cron/payment-reminders", { headers: auth ? { authorization: auth } : {} }));

describe("payment reminders cron (T06)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "s3cret";
    db.state.claimed.clear();
    db.state.notifications.length = 0;
    sendEmail.mockReset().mockResolvedValue(null);
    const [dueIn7] = [...reminderDueDates(new Date()).keys()];
    db.state.installments = [
      {
        id: "inst-1",
        due_date: dueIn7,
        amount_due: 33334,
        installment_accounts: {
          transactions: { id: "tx-1", customer_id: "buyer-1", vehicles: { make: "Toyota", model: "Vios", year: 2022 } },
        },
      },
    ];
  });

  it("refuses a call without the cron secret", async () => {
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
  });

  it("emails and notifies the buyer once per window", async () => {
    await expect((await call("Bearer s3cret")).json()).resolves.toMatchObject({ sent: 1, failed: 0 });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "maria@example.com", subject: expect.stringContaining("due in 7 days") }),
    );
    expect(db.state.notifications).toHaveLength(1);

    await expect((await call("Bearer s3cret")).json()).resolves.toMatchObject({ sent: 0 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
