import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/00060_t01_financing_chat_access.sql"),
  "utf8",
);

describe("T01 financing chat access migration", () => {
  it("lets the Sales Manager open financing threads and read and send their messages", () => {
    expect(migration).toMatch(/ON public\.inquiries FOR SELECT/);
    expect(migration).toMatch(/ON public\.inquiry_messages FOR SELECT/);
    expect(migration).toMatch(/ON public\.inquiry_messages FOR INSERT/);
    expect(migration.match(/role = 'sales_manager'/g)).toHaveLength(3);
  });

  it("is limited to financing threads and to the sender's own messages", () => {
    expect(migration.match(/intention_kind = 'buy_financing'/g)).toHaveLength(3);
    expect(migration).toMatch(/WITH CHECK \(\s+sender_id = auth\.uid\(\)/);
  });

  it("only adds policies", () => {
    expect(migration).not.toMatch(/DROP|ALTER TABLE|FOR (ALL|UPDATE|DELETE)|DISABLE ROW LEVEL SECURITY/i);
  });
});
