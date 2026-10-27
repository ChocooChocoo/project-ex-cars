import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261026130000_t03_customer_counter_offers_attachments.sql"),
  "utf8",
);

const policy = (name: string) => {
  const start = migration.indexOf(`CREATE POLICY "${name}"`);
  expect(start, `${name} is created`).toBeGreaterThan(-1);
  return migration.slice(start, migration.indexOf(";", start));
};

describe("T03 counter-offer remarks and chat attachments migration", () => {
  it("adds seller remarks to inspection issue reports", () => {
    expect(migration).toMatch(
      /ALTER TABLE public\.inspection_issue_reports ADD COLUMN IF NOT EXISTS seller_remarks TEXT/,
    );
  });

  it("creates a private message-attachments bucket limited to images and PDFs", () => {
    const bucket = migration.slice(migration.indexOf("INSERT INTO storage.buckets"));
    expect(bucket).toMatch(/'message-attachments',\s*'message-attachments',\s*false,\s*10485760/);
    expect(bucket).toContain("'application/pdf'");
    expect(bucket).not.toContain("true");
  });

  it("lets anyone who can read the message read its attachments", () => {
    expect(policy("Participants can read attachments")).toMatch(
      /EXISTS \(SELECT 1 FROM public\.inquiry_messages AS m WHERE m\.id = message_attachments\.message_id\)/,
    );
  });

  it("lets only the message's sender attach files", () => {
    const body = policy("Participants can upload attachments");
    expect(body).toMatch(/uploader_id = auth\.uid\(\)/);
    expect(body).toMatch(/m\.sender_id = auth\.uid\(\)/);
  });
});
