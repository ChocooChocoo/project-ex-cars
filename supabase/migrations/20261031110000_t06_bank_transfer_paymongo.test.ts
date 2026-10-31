import { describe, expect, it } from "vitest";

import { BUYER_PAYMENT_METHODS, PURCHASE_PAYMENT_METHODS } from "@/lib/transactions/state-machine";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261031110000_t06_bank_transfer_paymongo.sql"),
  "utf8",
);

describe("T06 bank transfer through PayMongo migration", () => {
  it("moves PayMongo purchase rows to bank transfer before tightening the check", () => {
    const update = migration.indexOf("SET payment_method = 'bank_transfer' WHERE payment_method = 'paymongo'");
    expect(update).toBeGreaterThan(-1);
    expect(update).toBeLessThan(migration.indexOf("ADD CONSTRAINT purchase_details_payment_method_check"));
  });

  it("drops PayMongo from the purchase method check", () => {
    expect(migration).toMatch(/CHECK \(payment_method IN \('cash', 'financing', 'down_payment', 'bank_transfer'\)\)/);
    const purchase = migration.match(/CHECK \(payment_method IN \(([^)]*)\)\)/)?.[1] ?? "";
    expect([...purchase.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).not.toContain("paymongo");
  });

  it("matches the methods the app accepts for a purchase", () => {
    const purchase = migration.match(/CHECK \(payment_method IN \(([^)]*)\)\)/)?.[1] ?? "";
    expect([...purchase.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort()).toEqual(
      [...PURCHASE_PAYMENT_METHODS].sort(),
    );
    expect([...BUYER_PAYMENT_METHODS].every((method) => purchase.includes(method))).toBe(true);
  });

  it("leaves the payment records channel alone", () => {
    expect(migration).not.toMatch(/ALTER TABLE public\.payment_records/);
    expect(migration).not.toMatch(/payment_records_method_check/);
  });

  it("only replaces constraints", () => {
    expect(migration).not.toMatch(/DROP (TABLE|COLUMN|POLICY)/i);
  });
});
