// @ts-nocheck
// Seed script: creates GCE demo users.
//
// Usage:
//   node --env-file=.env.local scripts/seed-users.cjs
//
// Users are created with the "customer" role (auto-assigned by DB trigger).
// After running this, assign proper roles with:
//   npx supabase db query --linked --file scripts/seed-roles.sql

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is not set");
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD;
if (!DEFAULT_PASSWORD) {
  console.error("SEED_USER_PASSWORD is not set");
  process.exit(1);
}

const SEED_USERS = [
  { role: "customer", name: "Juan Dela Cruz", email: "customer@gce.local" },
  { role: "supplier", name: "Maria Santos", email: "supplier@gce.local" },
  { role: "ceo", name: "Roberto Gonzales", email: "ceo@gce.local" },
  { role: "account_manager", name: "Angela Reyes", email: "account_manager@gce.local" },
  { role: "head_accountant", name: "Benjamin Tan", email: "head_accountant@gce.local" },
  { role: "confidential_informant", name: "Carlos Mendoza", email: "confidential_informant@gce.local" },
  { role: "marketing_specialist", name: "Diana Lim", email: "marketing_specialist@gce.local" },
  { role: "mechanic", name: "Eduardo Aquino", email: "mechanic@gce.local" },
  { role: "sales_manager", name: "Fatima Castro", email: "sales_manager@gce.local" },
  { role: "head_security", name: "Gregorio Villanueva", email: "head_security@gce.local" },
];

async function seed() {
  // Step 1: Delete existing seed users
  console.log("Cleaning up existing seed users...\n");
  const { data: existing } = await admin.auth.admin.listUsers();
  const seedEmails = new Set(SEED_USERS.map((u) => u.email));
  const toDelete = (existing?.users ?? []).filter((u) => seedEmails.has(u.email));
  for (const u of toDelete) {
    process.stdout.write(`Deleting ${u.email}... `);
    const { error } = await admin.auth.admin.deleteUser(u.id);
    console.log(error ? `FAILED: ${error.message}` : "OK");
  }

  // Step 2: Create all seed users (DB trigger auto-assigns "customer" role)
  console.log("\nCreating seed users...\n");
  for (const u of SEED_USERS) {
    process.stdout.write(`Creating ${u.role} (${u.email})... `);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.name },
    });

    if (createErr) {
      console.log(`FAILED: ${createErr.message}`);
      continue;
    }

    await admin.from("profiles").update({ full_name: u.name }).eq("id", created.user.id);
    console.log("OK");
  }

  console.log(`\nUsers created with default "customer" role.`);
  console.log(`Run: npx supabase db query --linked --file scripts/seed-roles.sql`);
}

seed();
