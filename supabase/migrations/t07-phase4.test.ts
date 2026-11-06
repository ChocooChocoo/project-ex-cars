import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("T07 financing payment migration", () => {
  it("extends the ledger and guards sold against unpaid open financing, even on completed transactions", () => {
    const sql = readFileSync(resolve("supabase/migrations/20261106130000_t07_financing_payments.sql"), "utf8");
    for (const fragment of [
      "DROP CONSTRAINT IF EXISTS payment_records_payment_kind_check",
      "'installment'",
      "submitted_by UUID REFERENCES public.profiles(id)",
      "(transaction_id, installment_id, rejected_at)",
      "guard_financing_sold()",
      "SECURITY DEFINER",
      "SET search_path = ''",
      "BEFORE UPDATE OF listing_state ON public.vehicles",
      "NEW.listing_state = 'sold'",
      "OLD.listing_state IS DISTINCT FROM 'sold'",
      "a.state = 'active'",
      "NOT IN ('paid', 'waived')",
      "check_violation",
    ])
      expect(sql).toContain(fragment);
    expect(sql).not.toContain("current_state");
  });
});
