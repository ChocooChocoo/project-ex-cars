import pg from "pg";

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required in .env.local.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const DROP_SQL_PATH = join(__dirname, "drop-schemas.sql");

async function runSql(label, sql) {
  try {
    await pool.query(sql);
    console.log(`OK: ${label}`);
  } catch (err) {
    console.error(`FAILED: ${label}`);
    console.error(err.message);
    process.exit(1);
  }
}

async function run() {
  console.log("Step 1/2: Dropping application schemas...");
  await runSql("drop-schemas.sql", readFileSync(DROP_SQL_PATH, "utf8"));

  console.log("Step 2/2: Running all migrations...");
  const migrationFiles = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await runSql(file, sql);
  }

  console.log(`\nDone. Applied ${migrationFiles.length} migrations.`);
  await pool.end();
}

run();
