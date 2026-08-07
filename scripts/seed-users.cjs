// @ts-nocheck
const { createClient } = require("@supabase/supabase-js");

const admin = createClient(
  "https://nsdwyxwrsmtarrxgzeuj.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZHd5eHdyc210YXJyeGd6ZXVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA1MDQ2OCwiZXhwIjoyMTAxNjI2NDY4fQ.gv21JF9-hatQZieEz58NoV_b2VCgqVUJoIg0U7m8JhQ",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DEFAULT_PASSWORD = "GCEtest123!@#";

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
  console.log("Seeding users...\n");

  for (const u of SEED_USERS) {
    process.stdout.write(`Creating ${u.role} (${u.email})... `);

    // Check if already exists
    const { data: existing } = await admin.auth.admin.listUsers();
    if (existing?.users?.find((x) => x.email === u.email)) {
      console.log("already exists, skipping.");
      continue;
    }

    // Create user
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

    const uid = created.user.id;

    // Update profile with full name
    await admin.from("profiles").update({ full_name: u.name }).eq("id", uid);

    // Assign role
    const { error: roleErr } = await admin.rpc("assign_user_role", {
      p_account_id: uid,
      p_role: u.role,
      p_assigned_by: uid,
    });

    if (roleErr) {
      console.log(`created but role FAILED: ${roleErr.message}`);
    } else {
      console.log("OK");
    }
  }

  console.log("\nSeeding complete.");
  console.log(`Default password for all users: ${DEFAULT_PASSWORD}`);
}

seed();
