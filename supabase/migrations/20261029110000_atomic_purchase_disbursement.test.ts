import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261029110000_atomic_purchase_disbursement.sql"),
  "utf8",
);

describe("atomic purchase disbursement migration contract", () => {
  it("locks both payment and transaction before writing, with no swallowed exceptions", () => {
    const firstWrite = sql.indexOf("UPDATE public.disbursement_requests");
    expect(firstWrite).toBeGreaterThan(-1);
    expect(sql).toContain("WHERE id = p_disbursement_id FOR UPDATE");
    expect(sql).toContain("WHERE id = v_request.purchase_transaction_id FOR UPDATE");
    expect(sql.indexOf("WHERE id = p_disbursement_id FOR UPDATE")).toBeLessThan(firstWrite);
    expect(sql.indexOf("WHERE id = v_request.purchase_transaction_id FOR UPDATE")).toBeLessThan(firstWrite);
    expect(sql.replace(/--[^\n]*/g, "")).not.toMatch(/EXCEPTION\s+WHEN|\bCOMMIT\b|\bROLLBACK\b/i);
  });

  it("guards the elevated function with the authenticated Head Accountant identity", () => {
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain("v_actor UUID := auth.uid()");
    expect(sql).toContain("v_actor IS NULL OR NOT EXISTS");
    expect(sql).toContain("account_id = v_actor AND active = true AND role = 'head_accountant'");
    expect(sql).toContain("FROM PUBLIC, anon");
    expect(sql).toContain("TO authenticated");
  });

  it("accepts legacy paid retries and guards each repeatable event or notification", () => {
    expect(sql).toContain("v_request.status NOT IN ('received', 'paid')");
    expect(sql).toContain("v_request.status = 'paid' AND v_tx.current_state = 'completed'");
    expect(sql).toContain("disbursement_id = v_request.id AND event_kind = 'paid'");
    expect(sql).toContain("kind = 'sell_payment_disbursed' AND recipient_role = 'ceo'");
    expect(sql).toContain("kind = 'sell_vehicle_ready_to_post' AND recipient_role = 'marketing_specialist'");
    expect(sql).toContain("WHERE id = v_tx.vehicle_id AND listing_state = 'draft'");
  });
});
