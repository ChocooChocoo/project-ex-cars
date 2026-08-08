// @ts-nocheck

import dns from "node:dns";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const POOLER_IPS = process.env.SUPABASE_POOLER_IPS
  ? process.env.SUPABASE_POOLER_IPS.split(",").map((s) => s.trim())
  : ["54.255.219.82", "52.77.146.31", "52.74.252.201"];
const DB_HOST = process.env.SUPABASE_DB_HOST || "db.example.supabase.co";
let poolerIdx = 0;
const origLookup = dns.lookup;

dns.lookup = (hostname, options, callback) => {
  if (hostname === DB_HOST) {
    const ip = POOLER_IPS[poolerIdx % POOLER_IPS.length]!;
    poolerIdx++;
    const cb = typeof options === "function" ? options : callback;
    cb(null, ip, 4);
    return;
  }
  return origLookup(hostname, options, callback);
};

import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sqlPath = join(__dirname, "..", "supabase", "migrations", "00001_phase1_schema.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log("Running migration: 00001_phase1_schema.sql");
  console.log(`DNS override: ${DB_HOST} -> ${POOLER_IPS[0]}`);

  try {
    const result = await pool.query(sql);
    console.log("Migration completed successfully.");
    console.log("Commands:", result.length);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
