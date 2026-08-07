import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const POOLER_IPS = ["54.255.219.82", "52.77.146.31", "52.74.252.201"];
const DB_HOST = "db.nsdwyxwrsmtarrxgzeuj.supabase.co";
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
  const sqlPath = join(__dirname, "..", "supabase", "migrations", "00001_phase1_schema.sql");
  const sql = readFileSync(sqlPath, "utf8");

  console.log("Running migration: 00001_phase1_schema.sql");

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
