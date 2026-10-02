import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00055_t02_hide_unsubmitted_buys.sql"),
  "utf8",
);

describe("T02 hide unsubmitted buys migration", () => {
  it("hides only customer-created buy rows that were never submitted", () => {
    expect(migration).toMatch(/CREATE POLICY "Staff can read all transactions"\s+ON public\.transactions FOR SELECT/);
    expect(migration).toMatch(
      /AND NOT \(\s*transaction_kind = 'buy'\s*AND current_state = 'pending'\s*AND flow_status IS NULL\s*AND queue_state IS NULL\s*AND created_by = customer_id\s*\)/,
    );
    expect(migration).toMatch(/'ceo', 'sales_manager', 'account_manager', 'head_accountant', 'confidential_informant'/);
  });

  it("caps transaction documents at 5 MB on the bucket", () => {
    expect(migration).toMatch(/file_size_limit = 5242880 WHERE id = 'transaction-documents'/);
  });
});
