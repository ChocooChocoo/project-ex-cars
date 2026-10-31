import { describe, expect, it } from "vitest";

import { BUYER_PAYMENT_METHODS, PAYMENT_METHODS, PURCHASE_PAYMENT_METHODS } from "@/lib/transactions/state-machine";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261028100000_t04_payment_option.sql"),
  "utf8",
);

describe("T04 payment option migration", () => {
  it("adds the payment option and backfills it from the method", () => {
    expect(migration).toMatch(
      /ADD COLUMN IF NOT EXISTS payment_option TEXT CHECK \(payment_option IN \('full', 'financing'\)\)/,
    );
    expect(migration).toMatch(/CASE WHEN payment_method = 'financing' THEN 'financing' ELSE 'full' END/);
  });

  it("moves cheque rows to bank transfer before tightening the checks", () => {
    const update = migration.indexOf("SET payment_method = 'bank_transfer' WHERE payment_method = 'cheque'");
    const records = migration.indexOf("SET method = 'bank_transfer' WHERE method = 'cheque'");
    expect(update).toBeGreaterThan(-1);
    expect(records).toBeGreaterThan(-1);
    expect(update).toBeLessThan(migration.indexOf("ADD CONSTRAINT purchase_details_payment_method_check"));
    expect(records).toBeLessThan(migration.indexOf("ADD CONSTRAINT payment_records_method_check"));
  });

  it("drops cheque and allows PayMongo on purchases", () => {
    expect(migration).toMatch(
      /CHECK \(payment_method IN \('cash', 'financing', 'down_payment', 'bank_transfer', 'paymongo'\)\)/,
    );
    expect(migration).toMatch(/CHECK \(method IN \('cash', 'financing', 'bank_transfer', 'paymongo'\)\)/);
    expect(migration).not.toMatch(/IN \([^)]*'cheque'/);
  });

  it("matches the methods the app accepted before T06 split them", () => {
    const methods = migration.match(/CHECK \(payment_method IN \(([^)]*)\)\)/)?.[1] ?? "";
    const listed = [...methods.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    // T04 predates T06: purchases still carried PayMongo, and Financing plus legacy down_payment stayed.
    expect(listed.sort()).toEqual([...BUYER_PAYMENT_METHODS, "financing", "down_payment", "paymongo"].sort());
    expect([...PURCHASE_PAYMENT_METHODS, "paymongo"].sort()).toEqual([...PAYMENT_METHODS].sort());
  });

  it("offers every financing term", () => {
    expect(migration).toMatch(/CHECK \(requested_term_months IN \(6, 12, 24, 36, 60\)\)/);
  });

  it("only replaces constraints", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
  });
});
