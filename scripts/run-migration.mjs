import pg from "pg";

import dns from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(__dirname, "..", ".env.local"));

const POOLER_IPS = process.env.SUPABASE_POOLER_IPS
  ? process.env.SUPABASE_POOLER_IPS.split(",").map((s) => s.trim())
  : ["54.255.219.82", "52.77.146.31", "52.74.252.201"];
const DB_HOST = process.env.SUPABASE_DB_HOST || "db.nsdwyxwrsmtarrxgzeuj.supabase.co";
let poolerIdx = 0;

const origLookupFn = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === DB_HOST) {
    const ip = POOLER_IPS[poolerIdx % POOLER_IPS.length];
    poolerIdx++;
    let cb;
    if (typeof options === "function") {
      cb = options;
    } else if (typeof callback === "function") {
      cb = callback;
    }
    if (typeof cb !== "function") {
      return origLookupFn(hostname, options, callback);
    }
    console.log(`DNS lookup override: ${hostname} -> ${ip}`);
    cb(null, ip, 4);
    return;
  }
  return origLookupFn(hostname, options, callback);
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const migrationFile = process.argv[2];
  if (!migrationFile) {
    console.error("Usage: node run-migration.mjs <migration-filename>");
    console.error("Example: node run-migration.mjs 00035_combined_rls_fixes.sql");
    process.exit(1);
  }
  // Allow paths outside the migrations dir (e.g. ../scripts/seed-roles.sql).
  const sqlPath = migrationFile.includes("/") || migrationFile.includes("\\")
    ? resolve(__dirname, migrationFile)
    : join(__dirname, "..", "supabase", "migrations", migrationFile);
  const sql = readFileSync(sqlPath, "utf8");

  console.log(`Running migration: ${migrationFile}`);

  try {
    const result = await pool.query(sql);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
