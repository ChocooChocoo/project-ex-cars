import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261026120000_t03_vehicle_purpose_owner_number.sql"),
  "utf8",
);

describe("T03 vehicle purpose and owner number migration", () => {
  it("adds purpose to vehicles and car requests, and the owner number to sell details", () => {
    expect(migration).toMatch(/ALTER TABLE public\.vehicles ADD COLUMN IF NOT EXISTS purpose TEXT/);
    expect(migration).toMatch(/ALTER TABLE public\.vehicle_requests ADD COLUMN IF NOT EXISTS purpose TEXT/);
    expect(migration).toMatch(/owner_number SMALLINT CHECK \(owner_number >= 1\)/);
  });

  it("allows issue_photo documents and keeps every earlier kind", () => {
    const check = migration.slice(migration.indexOf("ADD CONSTRAINT transaction_documents_document_kind_check"));
    for (const kind of ["valid_id", "sell_photo", "orcr", "deed_of_sale", "inspection_photo", "issue_photo"]) {
      expect(check).toContain(`'${kind}'`);
    }
  });

  it("lets a seller add issue photos only to their own sell offer, as verified attachments", () => {
    const policy = migration.slice(migration.indexOf('CREATE POLICY "Customers can upload own issue photos"'));
    expect(policy).toMatch(/uploader_id = auth\.uid\(\)/);
    expect(policy).toMatch(/document_kind = 'issue_photo'/);
    expect(policy).toMatch(/transactions\.customer_id = auth\.uid\(\)/);
    expect(policy).toMatch(/transaction_kind = 'sell'/);
  });
});
