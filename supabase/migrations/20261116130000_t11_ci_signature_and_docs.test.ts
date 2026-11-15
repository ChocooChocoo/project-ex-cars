import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261116130000_t11_ci_signature_and_docs.sql"),
  "utf8",
);

describe("T11 CI signature and document notes", () => {
  it("keeps the Confidential Informant's signature path on the handover", () => {
    expect(migration).toMatch(/ALTER TABLE public\.sale_handovers\s+ADD COLUMN IF NOT EXISTS ci_signature_path TEXT/);
  });

  it("allows an in-app signature, not only e-signature or face-to-face", () => {
    expect(migration).toMatch(/DROP CONSTRAINT IF EXISTS sale_handovers_signing_method_check/);
    expect(migration).toMatch(/ADD CONSTRAINT sale_handovers_signing_method_check/);
    expect(migration).toMatch(/CHECK \(signing_method IN \('e_signature', 'face_to_face', 'in_app'\)\)/);
  });

  it("adds a note to transaction documents", () => {
    expect(migration).toMatch(/ALTER TABLE public\.transaction_documents\s+ADD COLUMN IF NOT EXISTS note TEXT/);
  });

  it("wraps the change in a transaction", () => {
    expect(migration).toMatch(/^BEGIN;$/m);
    expect(migration).toMatch(/^COMMIT;$/m);
  });
});
