import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261104130000_t06rc_signing_method.sql"),
  "utf8",
);

describe("T06 signing method migration", () => {
  it("records how the buyer signs, and the e-signature image", () => {
    expect(migration).toMatch(/signing_method TEXT CHECK \(signing_method IN \('e_signature', 'face_to_face'\)\)/);
    expect(migration).toMatch(/signature_path TEXT/);
    expect(migration).not.toMatch(/NOT NULL|DROP|UPDATE /);
  });
});
