// @ts-nocheck
const { readFileSync } = require("fs");
const { join } = require("path");
const dns = require("dns");

const POOLER_IPS = ["54.255.219.82", "52.77.146.31", "52.74.252.201"];
const DB_HOST = "db.nsdwyxwrsmtarrxgzeuj.supabase.co";
let poolerIdx = 0;

const origLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (hostname === DB_HOST) {
    const ip = POOLER_IPS[poolerIdx % POOLER_IPS.length];
    poolerIdx++;
    const cb = typeof options === "function" ? options : callback;
    console.log(`DNS override: ${hostname} -> ${ip}`);
    // Node.js v24 expects array of address objects from dns.lookup
    process.nextTick(() => cb(null, [{ address: ip, family: 4 }]));
    return;
  }
  return origLookup(hostname, options, callback);
};

const { Client } = require("pg");

// Connect directly to PostgreSQL on pooler IP, using direct port 5432
// with SSL and SNI set to the project hostname
const client = new Client({
  host: DB_HOST,
  port: 5432,
  user: "postgres",
  password: "i8]WVbrg}yTq!hYW85fU",
  database: "postgres",
  ssl: {
    rejectUnauthorized: false,
    servername: DB_HOST,
  },
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
