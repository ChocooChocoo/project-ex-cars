import pg from "pg";

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
try {
  await client.connect();
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const { rows: tables } = await client.query(
    "SELECT schemaname, tablename FROM pg_tables WHERE schemaname IN ('public', 'private') ORDER BY schemaname, tablename",
  );
  const data = [];
  for (const { schemaname, tablename } of tables) {
    const { rows } = await client.query(`SELECT * FROM ${quote(schemaname)}.${quote(tablename)}`);
    data.push({ table: `${schemaname}.${tablename}`, rows });
  }
  const { rows: migrationTables } = await client.query(
    "SELECT to_regclass('supabase_migrations.schema_migrations') AS name",
  );
  const appliedMigrations = migrationTables[0].name
    ? (await client.query("SELECT * FROM supabase_migrations.schema_migrations ORDER BY version")).rows
    : [];
  await client.query("COMMIT");
  const manifest = {
    createdAt: new Date().toISOString(),
    schemas: ["public", "private"],
    rowCounts: Object.fromEntries(data.map(({ table, rows }) => [table, rows.length])),
    migrationFiles: readdirSync(join(root, "supabase/migrations"))
      .filter((name) => name.endsWith(".sql"))
      .sort(),
    appliedMigrations,
  };
  const directory = join(root, "backups");
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `t07-${manifest.createdAt.replaceAll(/[:.]/g, "-")}.json`);
  writeFileSync(path, JSON.stringify({ manifest, data }, null, 2), { flag: "wx", mode: 0o600 });
  const backup = JSON.parse(readFileSync(path, "utf8"));
  for (const table of ["public.suppliers", "public.vehicle_requests", "public.transactions"]) {
    if (!backup.data.some((entry) => entry.table === table && entry.rows.length > 0)) {
      throw new Error(`Backup verification failed: ${table} has no rows.`);
    }
  }
  if (statSync(path).size < 1024) throw new Error("Backup unexpectedly small.");
  console.log(JSON.stringify({ path, bytes: statSync(path).size, rowCounts: manifest.rowCounts }, null, 2));
} finally {
  await client.end();
}
