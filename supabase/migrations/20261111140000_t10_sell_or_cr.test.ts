import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20261111140000_t10_sell_or_cr.sql"), "utf8");

describe("T10 separate OR and CR migration", () => {
  it("allows the OR and the CR as their own documents and keeps the old combined kind", () => {
    expect(migration).toMatch(/'orcr', 'official_receipt', 'certificate_of_registration'/);
  });

  it("lets the seller upload both as pending sell papers", () => {
    expect(migration).toMatch(
      /document_kind IN \('valid_id', 'orcr', 'official_receipt', 'certificate_of_registration', 'deed_of_sale'\)/,
    );
    expect(migration).toMatch(/verification_state = 'pending'/);
  });
});
