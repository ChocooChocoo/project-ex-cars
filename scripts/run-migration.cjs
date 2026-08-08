// @ts-nocheck
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const { Client } = require("pg");

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const sqlPath = join(__dirname, "..", "supabase", "migrations", "00001_phase1_schema.sql");
const sql = readFileSync(sqlPath, "utf8");

console.log("Running migration: 00001_phase1_schema.sql");

client.connect((err) => {
  if (err) {
    console.error("Connect failed:", err.message);
    process.exit(1);
  }
  console.log("Connected. Running SQL...");
  client.query(sql, (err2, result) => {
    if (err2) {
      console.error("Migration failed:", err2.message);
      client.end();
      process.exit(1);
    }
    console.log("Migration completed successfully.");
    console.log("Commands:", result.length);
    client.end();
  });
});
