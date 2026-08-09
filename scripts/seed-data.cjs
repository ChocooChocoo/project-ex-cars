// @ts-nocheck
// Seed script: populates the GCE database with deterministic demo data.
//
// Usage:
//   node --env-file=.env.local scripts/seed-data.cjs
//
// Prerequisites (run once):
//   node --env-file=.env.local scripts/seed-users.cjs
//   npx supabase db query --linked --file scripts/seed-roles.sql
//
// This script wipes and re-creates rows in every table it seeds, then inserts
// a full three-tier dataset: core marketplace data, staff/business records,
// and payroll/finance records. The Supabase project must be linked for the
// private-schema inserts (staff_compensation).

const { execFileSync, execSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { writeFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const zlib = require("node:zlib");

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

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";
const now = new Date();
const daysAgo = (n) => new Date(now.getTime() - n * 86400000);
const iso = (d) => d.toISOString();
const dateOnly = (d) => d.toISOString().slice(0, 10);
const phtDateOnly = (d) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
};
const phtTimestamp = (d, hour, minute = 0) =>
  `${phtDateOnly(d)}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`;
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Deterministic RNG so re-runs produce identical data.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260809);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

// ---------------------------------------------------------------------------
// Tiny PNG encoder (solid color / vertical gradient) so seeded media renders.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function makePng(width, height, rgbTop, rgbBottom) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor RGB
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 3);
    raw[rowStart] = 0; // filter: none
    const t = y / Math.max(1, height - 1);
    const r = Math.round(rgbTop[0] + (rgbBottom[0] - rgbTop[0]) * t);
    const g = Math.round(rgbTop[1] + (rgbBottom[1] - rgbTop[1]) * t);
    const b = Math.round(rgbTop[2] + (rgbBottom[2] - rgbTop[2]) * t);
    for (let x = 0; x < width; x++) {
      const o = rowStart + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hueToRgb(h) {
  const c = 0.6;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = 0.05;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function insert(table, rows, select = "id") {
  if (!rows || rows.length === 0) return [];
  const { data, error } = await admin.from(table).insert(rows).select(select);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function wipe(table) {
  const { error } = await admin.from(table).delete().neq("id", ZERO_UUID);
  if (error) throw new Error(`wipe ${table}: ${error.message}`);
}

function log(section, label, count) {
  console.log(`  ${section.padEnd(6)} ${label.padEnd(38)} ${String(count).padStart(4)}`);
}

// ---------------------------------------------------------------------------
// 1. Load seed users (created by scripts/seed-users.cjs)
// ---------------------------------------------------------------------------
async function loadUsers() {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const byEmail = new Map(data.users.map((u) => [u.email, u.id]));
  const wanted = {
    customer: "customer@gce.local",
    supplier: "supplier@gce.local",
    ceo: "ceo@gce.local",
    account_manager: "account_manager@gce.local",
    head_accountant: "head_accountant@gce.local",
    confidential_informant: "confidential_informant@gce.local",
    marketing_specialist: "marketing_specialist@gce.local",
    mechanic: "mechanic@gce.local",
    sales_manager: "sales_manager@gce.local",
    head_security: "head_security@gce.local",
  };
  const users = {};
  for (const [role, email] of Object.entries(wanted)) {
    const id = byEmail.get(email);
    if (!id) throw new Error(`Seed user ${email} not found. Run scripts/seed-users.cjs first.`);
    users[role] = id;
  }
  return users;
}

// ---------------------------------------------------------------------------
// Wipe order (children first so FK constraints hold)
// ---------------------------------------------------------------------------
const WIPE_TABLES = [
  "payslip_items",
  "payroll_approvals",
  "payslips",
  "payroll_runs",
  "security_duty_checks",
  "announcements",
  "reports",
  "disbursement_events",
  "disbursement_requests",
  "financial_entries",
  "performance_reviews",
  "employee_requests",
  "attendance_entries",
  "employee_work_schedules",
  "supplier_messages",
  "roadmap_items",
  "payment_records",
  "collection_actions",
  "installments",
  "installment_accounts",
  "payment_terms",
  "field_cases",
  "transaction_documents",
  "vehicle_requests",
  "sell_details",
  "purchase_details",
  "transaction_status_history",
  "transactions",
  "recommendation_feedback",
  "recommendation_results",
  "recommendation_runs",
  "message_attachments",
  "message_reports",
  "viewing_arrangements",
  "inquiry_messages",
  "inquiries",
  "vehicle_document_items",
  "part_replacements",
  "inspection_checklist_results",
  "inspection_checklist_nodes",
  "content_items",
  "favourites",
  "vehicle_price_proposals",
  "repairs",
  "vehicle_inspections",
  "vehicle_media",
  "vehicles",
  "supplier_documents",
  "suppliers",
  "customer_documents",
];

// ---------------------------------------------------------------------------
// 2. Suppliers (6)
// ---------------------------------------------------------------------------
async function seedSuppliers(users) {
  const created = [];
  const defs = [
    {
      kind: "company",
      name: "Northland Auto Trading",
      contact: "Ramon Delgado",
      state: "approved",
      route: "staff-created",
    },
    {
      kind: "company",
      name: "Metro Motors Supply",
      contact: "Liza Marcelo",
      state: "approved",
      route: "staff-created",
    },
    { kind: "individual", name: "Jose Ramirez", contact: "Jose Ramirez", state: "approved", route: "staff-created" },
    {
      kind: "company",
      name: "Southern Fleet Dealers",
      contact: "Nestor Villar",
      state: "pending_approval",
      route: "staff-created",
    },
    { kind: "individual", name: "Aileen Santos", contact: "Aileen Santos", state: "rejected", route: "staff-created" },
    {
      kind: "company",
      name: "Cavite Auto Parts Corp",
      contact: "Melchor Tan",
      state: "suspended",
      route: "staff-created",
    },
  ];
  for (const d of defs) {
    const decision =
      d.state === "approved" || d.state === "suspended" ? "approved" : d.state === "rejected" ? "rejected" : "pending";
    const { data, error } = await admin
      .from("suppliers")
      .insert({
        account_id: d.state === "approved" ? users.supplier : null,
        supplier_kind: d.kind,
        business_name: d.name,
        contact_name: d.contact,
        contact_email: `${d.contact.toLowerCase().replace(/ /g, ".")}@gce.local`,
        contact_phone: `09${randInt(100000000, 999999999)}`,
        created_by: users.account_manager,
        creation_route: d.route,
        approval_decision: decision,
        approved_by: d.state === "approved" ? users.account_manager : null,
        approved_at: d.state === "approved" ? iso(daysAgo(20)) : null,
        state: d.state,
      })
      .select("id")
      .single();
    if (error) throw error;
    created.push({ id: data.id, state: d.state, name: d.name });
  }
  log("P1", "suppliers", created.length);

  const docs = [];
  for (const s of created) {
    docs.push(
      {
        supplier_id: s.id,
        document_kind: "business_permit",
        is_primary_id: s.state === "approved",
        storage_path: `seed/suppliers/${s.id}/business_permit.pdf`,
        verification_state: s.state === "approved" ? "verified" : "pending",
        verified_by: s.state === "approved" ? users.account_manager : null,
        verified_at: s.state === "approved" ? iso(daysAgo(19)) : null,
      },
      {
        supplier_id: s.id,
        document_kind: "dti_registration",
        is_primary_id: false,
        storage_path: `seed/suppliers/${s.id}/dti_registration.pdf`,
        verification_state: s.state === "approved" ? "verified" : "pending",
        verified_by: s.state === "approved" ? users.account_manager : null,
        verified_at: s.state === "approved" ? iso(daysAgo(19)) : null,
      },
    );
  }
  const inserted = await insert("supplier_documents", docs);
  log("P1", "supplier_documents", inserted.length);
  return created;
}

// ---------------------------------------------------------------------------
// 3. Vehicles (30) + media uploads (photos + 360 frames)
// ---------------------------------------------------------------------------
const VEHICLE_SPECS = [
  ["Toyota", "Vios", 2021, 42000, "Good", "Sedan", "Gasoline", "Automatic"],
  ["Toyota", "Hilux", 2022, 31000, "Excellent", "Pickup", "Diesel", "Manual"],
  ["Toyota", "Innova", 2020, 68000, "Good", "MPV", "Diesel", "Automatic"],
  ["Toyota", "Fortuner", 2021, 52000, "Excellent", "SUV", "Diesel", "Automatic"],
  ["Toyota", "Camry", 2019, 78000, "Good", "Sedan", "Gasoline", "Automatic"],
  ["Mitsubishi", "Mirage G4", 2022, 18000, "Excellent", "Sedan", "Gasoline", "Manual"],
  ["Mitsubishi", "Xpander", 2021, 44000, "Good", "MPV", "Gasoline", "Automatic"],
  ["Mitsubishi", "Montero Sport", 2020, 72000, "Good", "SUV", "Diesel", "Automatic"],
  ["Mitsubishi", "L300", 2018, 96000, "Fair", "Van", "Diesel", "Manual"],
  ["Honda", "Civic", 2022, 15000, "Excellent", "Sedan", "Gasoline", "CVT"],
  ["Honda", "HR-V", 2021, 36000, "Excellent", "SUV", "Gasoline", "CVT"],
  ["Honda", "Brio", 2023, 8000, "Excellent", "Hatchback", "Gasoline", "Manual"],
  ["Honda", "City", 2020, 59000, "Good", "Sedan", "Gasoline", "CVT"],
  ["Ford", "Ranger", 2021, 48000, "Good", "Pickup", "Diesel", "Automatic"],
  ["Ford", "Everest", 2020, 66000, "Good", "SUV", "Diesel", "Automatic"],
  ["Nissan", "Almera", 2022, 21000, "Excellent", "Sedan", "Gasoline", "CVT"],
  ["Nissan", "Terra", 2021, 40000, "Good", "SUV", "Diesel", "Automatic"],
  ["Suzuki", "Ertiga", 2021, 38000, "Good", "MPV", "Gasoline", "Manual"],
  ["Suzuki", "Swift", 2022, 25000, "Excellent", "Hatchback", "Gasoline", "Automatic"],
  ["Hyundai", "Accent", 2020, 62000, "Good", "Sedan", "Diesel", "Manual"],
  ["Kia", "Stonic", 2022, 20000, "Excellent", "SUV", "Gasoline", "Automatic"],
  ["Isuzu", "mu-X", 2021, 47000, "Good", "SUV", "Diesel", "Automatic"],
  ["Mazda", "CX-5", 2021, 39000, "Excellent", "SUV", "Gasoline", "Automatic"],
  ["MG", "ZS", 2023, 6000, "Excellent", "SUV", "Gasoline", "CVT"],
  ["Geely", "Coolray", 2022, 17000, "Excellent", "SUV", "Gasoline", "DCT"],
  ["Nissan", "Navara", 2019, 88000, "Fair", "Pickup", "Diesel", "Manual"],
  ["Ford", "Fiesta", 2018, 102000, "Fair", "Hatchback", "Gasoline", "Manual"],
  ["Toyota", "Corolla Altis", 2019, 74000, "Good", "Sedan", "Gasoline", "CVT"],
  ["Honda", "Accord", 2018, 91000, "Good", "Sedan", "Gasoline", "CVT"],
  ["Mitsubishi", "Outlander", 2020, 57000, "Good", "SUV", "Gasoline", "CVT"],
];

const LISTING_POOL = [
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "available",
  "reserved",
  "reserved",
  "reserved",
  "reserved",
  "sold",
  "sold",
  "sold",
  "sold",
  "sold",
  "sold",
  "draft",
  "draft",
  "draft",
  "draft",
  "awaiting_price_approval",
  "inspecting",
  "repairing",
  "archived",
];
const COLORS = ["White", "Black", "Silver", "Gray", "Red", "Blue", "Green", "Maroon", "Beige", "Orange"];

async function seedVehicles(users) {
  const rows = VEHICLE_SPECS.map((spec, i) => {
    const [make, model, year, mileage, condition, bodyType, fuel, transmission] = spec;
    const state = LISTING_POOL[i];
    const pricePool = [
      548000, 1250000, 1180000, 1680000, 1180000, 798000, 1080000, 1580000, 698000, 1380000, 1280000, 698000, 898000,
      1480000, 1780000, 748000, 1480000, 898000, 798000, 648000, 1180000, 1580000, 1680000, 1080000, 1180000, 980000,
      598000, 998000, 1180000, 1280000,
    ];
    const color = pick(COLORS);
    return {
      stock_code: `GCE-${String(i + 1).padStart(3, "0")}`,
      vin: `SEEDVIN${String(i + 1).padStart(12, "0")}`,
      make,
      model,
      year,
      condition,
      mileage,
      fuel_type: fuel,
      transmission,
      exterior_color: color,
      interior_color: pick(COLORS),
      body_type: bodyType,
      engine: pick(["1.3L", "1.5L", "1.6L", "2.0L", "2.4L", "2.5L", "2.8L", "3.0L"]),
      description: `${year} ${make} ${model} in ${condition.toLowerCase()} condition. ${bodyType} with ${transmission.toLowerCase()} transmission. Well-maintained and ready for the road.`,
      current_price:
        state === "sold" || state === "reserved"
          ? pricePool[i]
          : state === "available"
            ? pricePool[i]
            : state === "awaiting_price_approval"
              ? null
              : state === "draft"
                ? null
                : pricePool[i],
      pricing_type: i % 3 === 0 ? "fixed" : "negotiable",
      warranty_details: i % 2 === 0 ? "6-month powertrain warranty" : "1-year limited warranty",
      offer_details: i % 4 === 0 ? "Free 1-year comprehensive insurance" : null,
      listing_state: state,
      posted_at: state === "available" || state === "reserved" ? iso(daysAgo(randInt(2, 60))) : null,
    };
  });
  const inserted = await insert("vehicles", rows, "id, listing_state");
  log("P2", "vehicles", inserted.length);

  // Media: 3 photos per vehicle + 360° frames for the first 3.
  const mediaRows = [];
  const uploads = [];
  for (let i = 0; i < inserted.length; i++) {
    const vehicleId = inserted[i].id;
    const hue = (i * 37) % 360;
    for (let p = 0; p < 3; p++) {
      const path = `seed/vehicles/${vehicleId}/photo-${p + 1}.png`;
      mediaRows.push({
        vehicle_id: vehicleId,
        media_kind: "photo",
        storage_path: path,
        display_order: p,
        public_state: true,
        uploaded_by: users.marketing_specialist,
      });
      uploads.push({
        path,
        buf: makePng(640, 480, hueToRgb((hue + p * 20) % 360), hueToRgb((hue + p * 20 + 40) % 360)),
      });
    }
    if (i < 3) {
      for (let f = 0; f < 8; f++) {
        const path = `seed/vehicles/${vehicleId}/360-${f + 1}.png`;
        mediaRows.push({
          vehicle_id: vehicleId,
          media_kind: "360_view",
          storage_path: path,
          display_order: 100 + f,
          public_state: true,
          uploaded_by: users.marketing_specialist,
        });
        uploads.push({
          path,
          buf: makePng(640, 480, hueToRgb((hue + f * 14) % 360), hueToRgb((hue + f * 14 + 30) % 360)),
        });
      }
    }
  }
  const mediaInserted = await insert("vehicle_media", mediaRows);
  log("P2", "vehicle_media", mediaInserted.length);

  console.log("  Uploading placeholder media to showroom-media bucket...");
  let uploaded = 0;
  for (const u of uploads) {
    const { error } = await admin.storage.from("showroom-media").upload(u.path, u.buf, {
      contentType: "image/png",
      upsert: true,
    });
    if (!error) uploaded++;
  }
  log("P2", "media uploads", uploaded);

  return inserted;
}

// ---------------------------------------------------------------------------
// 4. Inspection checklist template (6 systems -> components -> parts)
// ---------------------------------------------------------------------------
async function seedChecklistTemplate() {
  const systems = [
    {
      name: "Engine",
      components: [
        { name: "Engine Block", parts: ["Cylinder Head", "Pistons", "Timing Belt"] },
        { name: "Fuel System", parts: ["Fuel Pump", "Fuel Injectors", "Fuel Filter"] },
        { name: "Cooling System", parts: ["Radiator", "Water Pump", "Thermostat"] },
      ],
    },
    {
      name: "Transmission",
      components: [
        { name: "Manual Transmission", parts: ["Clutch Assembly", "Gearbox", "Clutch Cable"] },
        { name: "Automatic Transmission", parts: ["Torque Converter", "Valve Body", "Transmission Fluid"] },
      ],
    },
    {
      name: "Brakes",
      components: [
        { name: "Brake System", parts: ["Brake Pads", "Brake Discs", "Brake Lines"] },
        { name: "Parking Brake", parts: ["Cable", "Lever Assembly"] },
      ],
    },
    {
      name: "Suspension",
      components: [
        { name: "Front Suspension", parts: ["Shock Absorbers", "Control Arms", "Ball Joints"] },
        { name: "Rear Suspension", parts: ["Shock Absorbers", "Leaf Springs", "Bushings"] },
      ],
    },
    {
      name: "Electrical",
      components: [
        { name: "Battery & Charging", parts: ["Battery", "Alternator", "Starter Motor"] },
        { name: "Lighting", parts: ["Headlights", "Tail Lights", "Signal Lights"] },
      ],
    },
    {
      name: "Body & Interior",
      components: [
        { name: "Exterior Body", parts: ["Paint Condition", "Panels", "Windows"] },
        { name: "Interior", parts: ["Seats", "Dashboard", "Air Conditioning"] },
      ],
    },
  ];

  const nodeRows = [];
  let order = 0;
  for (const sys of systems) {
    const sysId = randomUUID();
    nodeRows.push({ id: sysId, parent_id: null, level: "system", name: sys.name, display_order: order++ });
    for (const comp of sys.components) {
      const compId = randomUUID();
      nodeRows.push({ id: compId, parent_id: sysId, level: "component", name: comp.name, display_order: order++ });
      for (const part of comp.parts) {
        nodeRows.push({ id: randomUUID(), parent_id: compId, level: "part", name: part, display_order: order++ });
      }
    }
  }
  const { data, error } = await admin.from("inspection_checklist_nodes").insert(nodeRows).select("id");
  if (error) throw error;
  log("P2", "checklist nodes", data.length);
  return nodeRows;
}

// ---------------------------------------------------------------------------
// 5. Inspections + checklist results + repairs + vehicle documents + price proposals
// ---------------------------------------------------------------------------
async function seedInspections(users, vehicles, checklistNodes) {
  const partNodes = checklistNodes.filter((n) => n.level === "part");
  const inspectable = vehicles.filter((_, i) => i >= 12).slice(0, 12);
  const inspectionRows = [];
  const inspectionKey = [];
  for (let i = 0; i < inspectable.length; i++) {
    const key = `I-${i + 1}`;
    inspectionRows.push({
      key,
      vehicle_id: inspectable[i].id,
      mechanic_id: users.mechanic,
      condition_score: randInt(58, 96),
      findings: pick([
        "Engine runs smoothly; minor belt wear observed.",
        "Transmission shifts cleanly; brake pads at 60%.",
        "Suspension needs front shock replacement.",
        "Minor body dents and paint scratches.",
        "Air conditioning needs recharging; electrical system OK.",
        "All systems within acceptable condition.",
      ]),
      recommendation: pick([
        "Ready for listing",
        "Ready after minor repairs",
        "Requires suspension work",
        "Recommended for resale",
        "Needs detailing before listing",
      ]),
      inspection_date: iso(daysAgo(randInt(3, 45))),
    });
    inspectionKey.push(key);
  }
  const inserted = await insert(
    "vehicle_inspections",
    inspectionRows.map(({ key, ...rest }) => rest),
  );
  log("P2", "vehicle_inspections", inserted.length);

  // Checklist results: answer each part node for each inspection.
  const results = [];
  for (const inspection of inserted) {
    for (const part of partNodes) {
      const roll = rand();
      const status = roll < 0.75 ? "good" : roll < 0.9 ? "for_repair" : "for_replacement";
      results.push({
        inspection_id: inspection.id,
        checklist_entry_id: part.id,
        status,
        notes:
          status === "good"
            ? null
            : pick(["Needs replacement soon", "Light wear", "Minor issue", "Requires immediate attention"]),
      });
    }
  }
  const resultsInserted = await insert(
    "inspection_checklist_results",
    results,
    "id, inspection_id, checklist_entry_id, status",
  );
  log("P2", "checklist_results", resultsInserted.length);

  // Part replacements for for_repair / for_replacement answers.
  const replacements = [];
  for (const r of resultsInserted) {
    if (r.status !== "good" && rand() < 0.7) {
      const label = partNodes.find((p) => p.id === r.checklist_entry_id)?.name ?? "Part";
      replacements.push({
        checklist_answer_id: r.id,
        item_name: `${label}`,
        brand: pick(["Genuine", "Aisin", "Denso", "Bosch", "NGK", "SKF"]),
        estimated_cost: randInt(800, 45000),
      });
    }
  }
  const replaced = await insert("part_replacements", replacements);
  log("P2", "part_replacements", replaced.length);

  // Repairs: 10 across vehicles.
  const repairRows = [];
  for (let i = 0; i < 10; i++) {
    const v = pick(inspectable);
    repairRows.push({
      vehicle_id: v.id,
      mechanic_id: users.mechanic,
      description: pick([
        "Replace front shock absorbers",
        "Replace brake pads and discs",
        "Engine tune-up and oil change",
        "Replace clutch assembly",
        "Fix radiator leak",
        "Recharge air conditioning",
      ]),
      status: pick(["pending", "in_progress", "completed", "cancelled"]),
      started_at: iso(daysAgo(randInt(5, 30))),
      completed_at: rand() < 0.5 ? iso(daysAgo(randInt(1, 10))) : null,
      notes: "Standard repair workflow",
    });
  }
  const repairs = await insert("repairs", repairRows);
  log("P2", "repairs", repairs.length);

  // Vehicle document checklist per vehicle.
  const docDefs = ["or_cr_certificate", "insurance", "emission_test", "deed_of_sale", "inspection_report"];
  const docRows = [];
  for (const v of vehicles) {
    for (const kind of docDefs) {
      const roll = rand();
      docRows.push({
        vehicle_id: v.id,
        document_kind: kind,
        required_state: true,
        submitted_state: roll < 0.6 ? "verified" : roll < 0.8 ? "submitted" : "required",
        storage_path: roll < 0.6 ? `seed/vehicles/${v.id}/${kind}.pdf` : null,
        checker_id: roll < 0.6 ? users.sales_manager : null,
        checked_at: roll < 0.6 ? iso(daysAgo(randInt(1, 40))) : null,
      });
    }
  }
  const docs = await insert("vehicle_document_items", docRows);
  log("P2", "vehicle_document_items", docs.length);

  // Price proposals: marketing proposes on awaiting/draft vehicles; CEO decides some.
  const proposals = [];
  for (const v of vehicles.filter((x, i) => i >= 12).slice(0, 10)) {
    const decision = pick(["pending", "approved", "rejected"]);
    proposals.push({
      vehicle_id: v.id,
      proposed_amount: randInt(450000, 1800000),
      proposer_id: users.marketing_specialist,
      decision,
      decider_id: decision === "pending" ? null : users.ceo,
      decision_date: decision === "pending" ? null : iso(daysAgo(randInt(2, 20))),
      notes: pick(["Proposed market price", "After inspection adjustments", "Competitor pricing review"]),
    });
  }
  const priceProps = await insert("vehicle_price_proposals", proposals);
  log("P2", "price_proposals", priceProps.length);
}

// ---------------------------------------------------------------------------
// 6. Inquiries + messages + arrangements + attachments + reports
// ---------------------------------------------------------------------------
async function seedInquiries(users, vehicles) {
  const rows = [];
  for (let i = 0; i < 20; i++) {
    const isBuyNow = i % 3 === 0;
    const state = pick(["open", "assigned", "scheduled", "handed_off", "closed"]);
    rows.push({
      customer_id: users.customer,
      vehicle_id: vehicles[i % vehicles.length].id,
      intention_kind: isBuyNow ? "buy_now" : "inquiry",
      assigned_account_manager: !isBuyNow && state !== "open" ? users.account_manager : null,
      assigned_sales_manager: isBuyNow && state !== "open" ? users.sales_manager : null,
      handoff_state: state === "handed_off" ? "handed_off" : state === "closed" ? pick(["none", "handed_off"]) : "none",
      state,
    });
  }
  const inserted = await insert("inquiries", rows, "id, state");
  log("P3", "inquiries", inserted.length);

  const msgRows = [];
  const customerLines = [
    "Hello, is this vehicle still available?",
    "What is the final price?",
    "Can I schedule a viewing this week?",
    "Is financing available for this unit?",
    "What is the mileage and condition?",
    "Are the service records available?",
    "Can you deliver to Cavite?",
    "What warranty comes with this?",
  ];
  const staffLines = [
    "Good day! Yes, the vehicle is still available.",
    "The final price is negotiable. We can discuss in person.",
    "We can schedule a viewing — when works best for you?",
    "Financing is available with flexible terms.",
    "Full service records are available for review.",
    "Delivery within CALABARZON can be arranged.",
    "The unit comes with a 6-month warranty.",
    "We can hold the unit with a reservation fee.",
  ];
  let messageCount = 0;
  for (const inquiry of inserted) {
    const turns = randInt(3, 9);
    let sender = users.customer;
    for (let t = 0; t < turns; t++) {
      const isCustomer = sender === users.customer;
      msgRows.push({
        inquiry_id: inquiry.id,
        sender_id: sender,
        message_text: isCustomer ? pick(customerLines) : pick(staffLines),
        sent_at: iso(addDays(daysAgo(randInt(1, 14)), t)),
        read_at: rand() < 0.7 ? iso(addDays(daysAgo(randInt(1, 14)), t)) : null,
      });
      sender = isCustomer ? (rand() < 0.7 ? users.account_manager : users.sales_manager) : users.customer;
      messageCount++;
    }
  }
  const messages = await insert("inquiry_messages", msgRows);
  log("P3", "inquiry_messages", messages.length);

  // Arrangements on ~8 scheduled/handed_off/closed inquiries.
  const arrRows = [];
  let arrCount = 0;
  for (const inquiry of inserted) {
    if (["scheduled", "handed_off", "closed"].includes(inquiry.state) && arrCount < 8) {
      arrRows.push({
        inquiry_id: inquiry.id,
        arrangement_kind: pick(["delivery", "meetup", "gce_visit"]),
        schedule: iso(addDays(now, randInt(1, 10))),
        location: pick(["GCE Office, Dasmariñas", "SM Mall of Asia", "Tagaytay", "Bacoor, Cavite"]),
        confirmation_state: pick(["pending", "confirmed", "completed"]),
        confirmed_by: rand() < 0.5 ? users.account_manager : users.sales_manager,
        notes: "Arranged during chat",
      });
      arrCount++;
    }
  }
  const arrangements = await insert("viewing_arrangements", arrRows);
  log("P3", "viewing_arrangements", arrangements.length);

  // Attachments: a few images on messages.
  const attRows = [];
  for (let i = 0; i < 8; i++) {
    const msg = messages[i * 3];
    if (!msg) break;
    attRows.push({
      message_id: msg.id,
      file_kind: "image",
      storage_path: `seed/messages/${msg.id}/photo.png`,
      original_name: pick(["vehicle-photo.png", "documents.png", "odometer.png", "plate.png"]),
      file_size: randInt(50000, 900000),
      uploader_id: users.customer,
    });
  }
  const attachments = await insert("message_attachments", attRows);
  log("P3", "message_attachments", attachments.length);

  // Reports: 3.
  const reportRows = [];
  for (let i = 0; i < 3; i++) {
    reportRows.push({
      reported_message_id: messages[i * 5]?.id ?? null,
      reported_inquiry_id: inserted[i].id,
      reporter_id: users.customer,
      reason: pick(["Spam message", "Inappropriate language", "Suspicious offer"]),
      state: pick(["open", "reviewed", "upheld", "dismissed"]),
      reviewer_id: rand() < 0.5 ? users.account_manager : null,
      decision_date: rand() < 0.5 ? iso(daysAgo(randInt(1, 8))) : null,
    });
  }
  const reports = await insert("message_reports", reportRows);
  log("P3", "message_reports", reports.length);
}

// ---------------------------------------------------------------------------
// 7. Transactions (12 buy, 6 sell, 7 request) + history + details + installments
// ---------------------------------------------------------------------------
async function seedTransactions(users, vehicles) {
  const created = [];
  const buyVehicles = vehicles.filter((v, i) => i >= 12).slice(0, 12);
  const buyStates = [
    "pending",
    "under_review",
    "approved",
    "completed",
    "completed",
    "cancelled",
    "pending",
    "approved",
    "completed",
    "under_review",
    "approved",
    "pending",
  ];

  for (let i = 0; i < 12; i++) {
    const state = buyStates[i];
    const { data, error } = await admin
      .from("transactions")
      .insert({
        customer_id: users.customer,
        transaction_kind: "buy",
        vehicle_id: buyVehicles[i].id,
        current_state: state,
        created_by: users.customer,
        opened_at: iso(daysAgo(randInt(5, 50))),
        completed_at: state === "completed" ? iso(daysAgo(randInt(1, 10))) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    created.push({ id: data.id, kind: "buy", state, vehicleId: buyVehicles[i].id });
  }

  for (let i = 0; i < 6; i++) {
    const state = pick(["pending", "under_review", "approved", "rejected", "completed"]);
    const { data, error } = await admin
      .from("transactions")
      .insert({
        customer_id: users.customer,
        transaction_kind: "sell",
        current_state: state,
        created_by: users.customer,
        opened_at: iso(daysAgo(randInt(5, 50))),
        completed_at: state === "completed" ? iso(daysAgo(randInt(1, 10))) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    created.push({ id: data.id, kind: "sell", state, vehicleId: null });
  }

  for (let i = 0; i < 7; i++) {
    const state = pick(["pending", "under_review", "approved", "completed", "cancelled"]);
    const { data, error } = await admin
      .from("transactions")
      .insert({
        customer_id: users.customer,
        transaction_kind: "request_a_car",
        current_state: state,
        created_by: users.customer,
        opened_at: iso(daysAgo(randInt(5, 50))),
        completed_at: state === "completed" ? iso(daysAgo(randInt(1, 10))) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    created.push({ id: data.id, kind: "request_a_car", state, vehicleId: null });
  }
  log("P5", "transactions", created.length);

  // Status history.
  const history = [];
  for (const t of created) {
    const fromTo = {
      pending: ["pending", "under_review"],
      under_review: ["under_review", "approved"],
      approved: ["approved", "completed"],
      rejected: ["pending", "rejected"],
      completed: ["pending", "under_review", "approved", "completed"],
      cancelled: ["pending", "cancelled"],
    };
    const seq =
      t.state === "completed" ? ["pending", "under_review", "approved", "completed"] : (fromTo[t.state] ?? ["pending"]);
    let prev = "pending";
    for (const s of seq) {
      if (s === prev && s !== "pending") continue;
      history.push({
        transaction_id: t.id,
        from_state: prev,
        to_state: s,
        actor_id: s === "completed" || s === "approved" ? users.sales_manager : users.customer,
        reason: pick([
          "Created by customer",
          "Under staff review",
          "Approved after review",
          "Transaction completed",
          "Cancelled by customer",
        ]),
        changed_at: iso(daysAgo(randInt(1, 45))),
      });
      prev = s;
    }
  }
  const histInserted = await insert("transaction_status_history", history);
  log("P5", "status_history", histInserted.length);

  // Details per kind.
  const buyTxs = created.filter((t) => t.kind === "buy");
  const purchaseRows = buyTxs.map((t) => ({
    transaction_id: t.id,
    payment_method: pick(["cash", "financing", "cheque", "down_payment"]),
    final_price: randInt(500000, 1800000),
    arrangement_kind: pick(["delivery", "meetup", "gce_visit"]),
    document_check_state: t.state === "completed" ? "verified" : pick(["pending", "verified"]),
    checked_by: t.state === "completed" ? users.sales_manager : null,
    checked_at: t.state === "completed" ? iso(daysAgo(randInt(1, 9))) : null,
  }));
  const purchases = await insert("purchase_details", purchaseRows);
  log("P5", "purchase_details", purchases.length);

  const sellTxs = created.filter((t) => t.kind === "sell");
  const sellRows = sellTxs.map((t) => ({
    transaction_id: t.id,
    offered_amount: randInt(300000, 1500000),
    valuation_amount: rand() < 0.6 ? randInt(280000, 1400000) : null,
    review_notes:
      t.state === "under_review" || t.state === "approved" ? "Vehicle inspected; valuation within range." : null,
    decision: t.state === "approved" ? "accepted" : t.state === "rejected" ? "rejected" : null,
    decision_maker_id: t.state === "approved" || t.state === "rejected" ? users.sales_manager : null,
    decision_date: t.state === "approved" || t.state === "rejected" ? iso(daysAgo(randInt(1, 20))) : null,
  }));
  const sells = await insert("sell_details", sellRows);
  log("P5", "sell_details", sells.length);

  const reqTxs = created.filter((t) => t.kind === "request_a_car");
  const reqRows = reqTxs.map((t) => ({
    transaction_id: t.id,
    requested_make: pick(["Toyota", "Honda", "Mitsubishi"]),
    requested_model: pick(["Hilux", "Civic", "Montero Sport"]),
    year_min: 2018,
    year_max: 2023,
    budget: randInt(700000, 1800000),
    other_preferences: pick(["Automatic transmission", "Diesel engine", "Low mileage", "White or silver color"]),
    agreed_price: t.state === "completed" ? randInt(750000, 1700000) : null,
    assigned_confidential_informant: rand() < 0.5 ? users.confidential_informant : null,
  }));
  const requests = await insert("vehicle_requests", reqRows);
  log("P5", "vehicle_requests", requests.length);

  // Financing: 4 installment accounts from financing purchases.
  const financedBuys = buyTxs.filter((t, i) => purchaseRows[i]?.payment_method === "financing");
  const accounts = [];
  for (let i = 0; i < Math.min(4, financedBuys.length); i++) {
    const t = financedBuys[i];
    const total = randInt(600000, 1600000);
    const down = Math.round(total * 0.2);
    const { data, error } = await admin
      .from("installment_accounts")
      .insert({
        purchase_transaction_id: t.id,
        financed_total: total,
        down_payment: down,
        opening_balance: total - down,
        start_date: dateOnly(daysAgo(randInt(30, 120))),
        state: pick(["active", "active", "closed"]),
        closed_date: rand() < 0.2 ? dateOnly(daysAgo(randInt(5, 30))) : null,
      })
      .select("id")
      .single();
    if (error) throw error;
    accounts.push({ id: data.id, balance: total - down, tx: t });
  }
  log("P5", "installment_accounts", accounts.length);

  // Installments for each account.
  const instRows = [];
  for (const acc of accounts) {
    const count = randInt(6, 12);
    const per = Math.round(acc.balance / count);
    const paidCount = randInt(0, count - 2);
    for (let s = 1; s <= count; s++) {
      const due = addDays(now, (s - count) * 30);
      const isPaid = s <= paidCount;
      const isOverdue = !isPaid && s === paidCount + 1 && rand() < 0.5;
      instRows.push({
        account_id: acc.id,
        sequence_no: s,
        due_date: dateOnly(due),
        amount_due: per,
        state: isPaid ? "paid" : isOverdue ? "overdue" : "upcoming",
        payment_date: isPaid ? dateOnly(due) : null,
      });
    }
  }
  const insts = await insert("installments", instRows);
  log("P5", "installments", insts.length);

  // Payment records.
  const payRows = [];
  for (const acc of accounts) {
    const { data: accountInsts } = await admin.from("installments").select("*").eq("account_id", acc.id);
    for (const inst of accountInsts ?? []) {
      if (inst.state === "paid") {
        payRows.push({
          transaction_id: acc.tx.id,
          installment_id: inst.id,
          amount: inst.amount_due,
          method: pick(["cash", "bank_transfer", "cheque"]),
          external_reference: `REF-${String(Math.floor(rand() * 100000)).padStart(5, "0")}`,
          recorded_by: users.head_accountant,
          verified_by: rand() < 0.8 ? users.head_accountant : null,
          settlement_date: inst.payment_date,
        });
      }
    }
  }
  // Plus a few standalone payments on non-financed buys.
  for (const t of buyTxs.filter((x) => !accounts.some((a) => a.tx.id === x.id)).slice(0, 6)) {
    payRows.push({
      transaction_id: t.id,
      installment_id: null,
      amount: randInt(500000, 1600000),
      method: pick(["cash", "cheque", "bank_transfer"]),
      external_reference: `REF-${String(Math.floor(rand() * 100000)).padStart(5, "0")}`,
      recorded_by: users.head_accountant,
      verified_by: rand() < 0.8 ? users.head_accountant : null,
      settlement_date: dateOnly(daysAgo(randInt(2, 30))),
    });
  }
  const payments = await insert("payment_records", payRows);
  log("P5", "payment_records", payments.length);

  // Collection actions on overdue installments.
  const overdueRows = [];
  const { data: overdue } = await admin.from("installments").select("*").eq("state", "overdue");
  for (const inst of overdue ?? []) {
    overdueRows.push({
      installment_id: inst.id,
      action_kind: pick(["notice", "ultimatum"]),
      actor_id: users.head_accountant,
      deadline: dateOnly(addDays(now, randInt(3, 14))),
      notes: "First collection notice sent to buyer.",
    });
  }
  const collections = await insert("collection_actions", overdueRows);
  log("P5", "collection_actions", collections.length);

  // Payment terms on financed purchases.
  const termsRows = [];
  for (const acc of accounts) {
    termsRows.push({
      purchase_transaction_id: acc.tx.id,
      arrangement_description: "Monthly installment arrangement with 20% down payment.",
      total_amount: acc.balance + Math.round(acc.balance * 0.1),
      down_payment: Math.round(acc.balance * 0.2),
      number_of_payments: randInt(6, 12),
      payment_frequency: pick(["weekly", "monthly"]),
      first_due_date: dateOnly(addDays(now, 30)),
      agreed_by: users.sales_manager,
      approver_id: users.head_accountant,
      approval_date: iso(daysAgo(randInt(1, 15))),
      state: pick(["approved", "active"]),
    });
  }
  const terms = await insert("payment_terms", termsRows);
  log("P5", "payment_terms", terms.length);

  // Field cases.
  const caseRows = [];
  for (let i = 0; i < 10; i++) {
    const v = pick(vehicles);
    caseRows.push({
      vehicle_id: v.id,
      transaction_id: created[i % created.length].id,
      case_kind: pick(["acquisition", "delivery", "recovery", "sourcing"]),
      assigned_confidential_informant: users.confidential_informant,
      mechanic_id: rand() < 0.4 ? users.mechanic : null,
      schedule: iso(addDays(now, randInt(1, 10))),
      location: pick(["Cavite", "Laguna", "Batangas", "Rizal", "Quezon"]),
      state: pick(["assigned", "accepted", "in_progress", "completed", "cancelled"]),
      completion_date: rand() < 0.4 ? iso(daysAgo(randInt(1, 12))) : null,
      expenses_cents: rand() < 0.5 ? randInt(500, 15000) * 100 : 0,
      notes: "Field work assigned through the dashboard.",
    });
  }
  const cases = await insert("field_cases", caseRows);
  log("P5", "field_cases", cases.length);

  return { created, buyTxs };
}

// ---------------------------------------------------------------------------
// 8. Favourites, content, recommendations
// ---------------------------------------------------------------------------
async function seedFavourites(users, vehicles) {
  const rows = [];
  const used = new Set();
  let count = 0;
  for (const v of vehicles) {
    if (count >= 30) break;
    if (v.listing_state !== "available") continue;
    if (used.has(v.id)) continue;
    used.add(v.id);
    rows.push({ customer_id: users.customer, vehicle_id: v.id });
    count++;
  }
  const inserted = await insert("favourites", rows);
  log("P4", "favourites", inserted.length);
}

async function seedContent(users, vehicles) {
  const rows = [
    {
      content_kind: "hero",
      title: "Drive Home Your Dream Car",
      body: "Discover quality pre-owned vehicles at Global Car Exchange.",
      publication_state: "published",
    },
    {
      content_kind: "hero",
      title: "Trusted Dealership. Verified Units.",
      body: "Every vehicle inspected by certified mechanics.",
      publication_state: "published",
    },
    {
      content_kind: "hero",
      title: "Flexible Payment Terms",
      body: "Weekly and monthly plans available on select units.",
      publication_state: "draft",
    },
    {
      content_kind: "promotion",
      title: "Free Insurance Promo",
      body: "Get 1-year comprehensive insurance on featured units.",
      publication_state: "published",
    },
    {
      content_kind: "promotion",
      title: "Year-End Clearance Sale",
      body: "Up to 10% off on 2020 models while stocks last.",
      publication_state: "published",
    },
    {
      content_kind: "promotion",
      title: "Trade-In Bonus",
      body: "Extra ₱20,000 trade-in value this month.",
      publication_state: "draft",
    },
    {
      content_kind: "featured_vehicle",
      title: "2022 Toyota Hilux — Featured",
      body: "Excellent condition, diesel, low mileage.",
      publication_state: "published",
    },
    {
      content_kind: "featured_vehicle",
      title: "2022 Honda Civic — Featured",
      body: "Top-rated fuel efficiency and performance.",
      publication_state: "published",
    },
    {
      content_kind: "featured_vehicle",
      title: "2021 Mitsubishi Montero — Featured",
      body: "Family-ready SUV with flexible financing.",
      publication_state: "draft",
    },
  ];
  const rowsWithVehicle = rows.map((r, i) => ({
    ...r,
    vehicle_id: i < 6 ? null : vehicles[i % vehicles.length].id,
    author_id: users.marketing_specialist,
    published_at: r.publication_state === "published" ? iso(daysAgo(randInt(3, 30))) : null,
  }));
  const inserted = await insert("content_items", rowsWithVehicle);
  log("P4", "content_items", inserted.length);
}

async function seedRecommendations(users, vehicles) {
  const budgets = [800000, 1000000, 1200000, 1500000, 700000, 900000];
  const prefs = [
    "Sedan, automatic, low mileage",
    "SUV, diesel, good condition",
    "Pickup for business use",
    "Family MPV, automatic",
    "Fuel-efficient hatchback",
    "Reliable commuter sedan",
  ];
  const runs = [];
  for (let i = 0; i < 6; i++) {
    const { data, error } = await admin
      .from("recommendation_runs")
      .insert({
        customer_id: users.customer,
        budget: budgets[i],
        stated_preferences: prefs[i],
        criteria_version: "1.0",
        run_date: iso(daysAgo(randInt(2, 40))),
      })
      .select("id")
      .single();
    if (error) throw error;
    runs.push(data.id);
  }
  log("P4", "recommendation_runs", runs.length);

  const results = [];
  for (const runId of runs) {
    const eligible = vehicles.filter((v) => v.listing_state === "available").slice(0, 8);
    eligible.forEach((v, rank) => {
      const base = 100 - rank * 6 - randInt(0, 4);
      results.push({
        run_id: runId,
        vehicle_id: v.id,
        budget_score: Math.max(55, base - randInt(0, 8)),
        condition_score: Math.max(55, base - randInt(0, 6)),
        fuel_score: Math.max(55, base - randInt(0, 10)),
        demand_score: Math.max(55, base - randInt(0, 8)),
        mileage_score: Math.max(55, base - randInt(0, 12)),
        total_score: base,
        rank: rank + 1,
      });
    });
  }
  const resultsInserted = await insert("recommendation_results", results);
  log("P4", "recommendation_results", resultsInserted.length);

  const feedback = [];
  for (let i = 0; i < 6; i++) {
    feedback.push({
      run_id: runs[i],
      selected_vehicle_id: vehicles[i % vehicles.length].id,
      helpful_state: pick(["helpful", "helpful", "not_helpful", "unknown"]),
      outcome: pick(["Contacted seller", "Purchased vehicle", "Still comparing options", null]),
      feedback_date: iso(daysAgo(randInt(1, 30))),
    });
  }
  const fb = await insert("recommendation_feedback", feedback);
  log("P4", "recommendation_feedback", fb.length);
}

// ---------------------------------------------------------------------------
// 9. Phase 6 — attendance, requests, performance
// ---------------------------------------------------------------------------
async function seedStaffRecords(users) {
  const staff = [
    { role: "ceo", id: users.ceo },
    { role: "mechanic", id: users.mechanic },
    { role: "sales_manager", id: users.sales_manager },
    { role: "marketing_specialist", id: users.marketing_specialist },
    { role: "account_manager", id: users.account_manager },
    { role: "head_accountant", id: users.head_accountant },
    { role: "confidential_informant", id: users.confidential_informant },
    { role: "head_security", id: users.head_security },
  ];

  const schedules = await insert(
    "employee_work_schedules",
    staff.map((person) => ({
      employee_id: person.id,
      workdays: [1, 2, 3, 4, 5, 6, 7],
      start_time: "08:00:00",
      end_time: "17:00:00",
      grace_minutes: 10,
      timezone: "Asia/Manila",
      created_by: users.account_manager,
      updated_by: users.account_manager,
    })),
  );
  log("P6", "employee_work_schedules", schedules.length);

  const attRows = [];
  for (const person of staff) {
    for (let d = 24; d >= 1; d--) {
      const date = addDays(now, -d);
      if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
      const roll = rand();
      const status = roll < 0.8 ? "present" : roll < 0.88 ? "late" : roll < 0.95 ? "on_leave" : "absent";
      const hasTimes = status === "present" || status === "late";
      attRows.push({
        employee_id: person.id,
        attendance_date: dateOnly(date),
        time_in: hasTimes ? new Date(date.setHours(8, randInt(0, 30), 0)).toISOString() : null,
        time_out: hasTimes ? new Date(date.setHours(17, randInt(0, 45), 0)).toISOString() : null,
        status,
        notes: status === "on_leave" ? "Approved leave" : status === "absent" ? "Unreported absence" : null,
        checked_by: rand() < 0.6 ? users.account_manager : null,
        checked_at: rand() < 0.6 ? iso(date) : null,
      });
    }
  }
  const att = await insert("attendance_entries", attRows);
  const deterministicAttendance = await insert("attendance_entries", [
    {
      employee_id: users.ceo,
      attendance_date: phtDateOnly(now),
      time_in: phtTimestamp(now, 8),
      time_out: phtTimestamp(now, 17),
      status: "present",
      notes: "Deterministic Task 18 present fixture",
      checked_by: null,
      checked_at: null,
    },
    {
      employee_id: users.account_manager,
      attendance_date: phtDateOnly(now),
      time_in: phtTimestamp(now, 8, 20),
      time_out: phtTimestamp(now, 17),
      status: "late",
      notes: "Deterministic Task 18 late fixture",
      checked_by: users.ceo,
      checked_at: iso(now),
    },
    {
      employee_id: users.head_accountant,
      attendance_date: phtDateOnly(now),
      time_in: null,
      time_out: null,
      status: "absent",
      notes: "Deterministic Task 18 absent fixture",
      checked_by: users.ceo,
      checked_at: iso(now),
    },
    {
      employee_id: users.marketing_specialist,
      attendance_date: phtDateOnly(now),
      time_in: phtTimestamp(now, 8),
      time_out: phtTimestamp(now, 12),
      status: "half_day",
      notes: "Deterministic Task 18 half-day fixture",
      checked_by: users.account_manager,
      checked_at: iso(now),
    },
    {
      employee_id: users.sales_manager,
      attendance_date: phtDateOnly(now),
      time_in: null,
      time_out: null,
      status: "on_leave",
      notes: "Deterministic Task 18 leave fixture",
      checked_by: users.account_manager,
      checked_at: iso(now),
    },
  ]);
  log("P6", "attendance_entries", att.length + deterministicAttendance.length);

  const reqRows = [];
  const reqKinds = ["leave", "overtime", "schedule_change", "other"];
  for (let i = 0; i < 15; i++) {
    const person = pick(staff);
    const kind = pick(reqKinds);
    const startDate = addDays(now, randInt(2, 30));
    const leaveDays = kind === "leave" ? randInt(0, 5) : 0;
    reqRows.push({
      employee_id: person.id,
      request_kind: kind,
      status: pick(["pending", "approved", "rejected"]),
      start_date: dateOnly(startDate),
      end_date: kind === "leave" ? dateOnly(addDays(startDate, leaveDays)) : null,
      reason: pick([
        "Family event",
        "Medical appointment",
        "Overtime for inventory week",
        "Schedule adjustment request",
        "Personal errand",
      ]),
      reviewed_by: rand() < 0.6 ? users.account_manager : null,
      review_notes: rand() < 0.4 ? "Approved by Account Manager" : null,
      reviewed_at: rand() < 0.6 ? iso(daysAgo(randInt(1, 10))) : null,
    });
  }
  reqRows.push({
    employee_id: users.mechanic,
    request_kind: "leave",
    status: "approved",
    start_date: phtDateOnly(now),
    end_date: phtDateOnly(now),
    reason: "Deterministic Task 18 approved-leave fixture",
    reviewed_by: users.account_manager,
    review_notes: "Approved fixture",
    reviewed_at: iso(now),
  });
  const requests = await insert("employee_requests", reqRows);
  log("P6", "employee_requests", requests.length);

  const reviewRows = [];
  for (let i = 0; i < 10; i++) {
    const person = pick(staff);
    reviewRows.push({
      employee_id: person.id,
      reviewer_id: users.account_manager,
      review_period_start: dateOnly(addDays(now, -90)),
      review_period_end: dateOnly(addDays(now, -30)),
      rating: randInt(3, 5),
      strengths: pick([
        "Reliable and consistent",
        "Excellent customer handling",
        "Strong technical skills",
        "Great team player",
      ]),
      areas_for_improvement: pick([
        "Needs faster turnaround",
        "Documentation could improve",
        "Time management",
        "None at this time",
      ]),
      goals: pick([
        "Complete certification this quarter",
        "Improve response times",
        "Mentor new staff",
        "Maintain quality rating",
      ]),
      status: pick(["draft", "submitted", "acknowledged"]),
      acknowledged_at: rand() < 0.3 ? iso(daysAgo(randInt(2, 15))) : null,
    });
  }
  const reviews = await insert("performance_reviews", reviewRows);
  log("P6", "performance_reviews", reviews.length);
}

// ---------------------------------------------------------------------------
// 10. Phase 6 — finance, disbursements, reports, announcements
// ---------------------------------------------------------------------------
async function seedFinance(users, transactions) {
  const entryRows = [];
  for (let i = 0; i < 18; i++) {
    entryRows.push({
      entry_kind: "revenue",
      amount_cents: randInt(500000, 1800000) * 100,
      transaction_id: transactions[i % transactions.length],
      description: pick(["Vehicle sale proceeds", "Reservation fee", "Trade-in valuation adjustment"]),
      recorded_by: users.account_manager,
      recorded_at: iso(daysAgo(randInt(2, 40))),
      verified_by: rand() < 0.7 ? users.head_accountant : null,
      verified_at: rand() < 0.7 ? iso(daysAgo(randInt(1, 30))) : null,
    });
  }
  for (let i = 0; i < 14; i++) {
    entryRows.push({
      entry_kind: "expense",
      amount_cents: randInt(2000, 120000) * 100,
      transaction_id: transactions[(i + 3) % transactions.length],
      description: pick(["Reconditioning parts", "Fuel and transport", "Advertising expense", "Vehicle detailing"]),
      recorded_by: users.account_manager,
      recorded_at: iso(daysAgo(randInt(2, 40))),
      verified_by: rand() < 0.7 ? users.head_accountant : null,
      verified_at: rand() < 0.7 ? iso(daysAgo(randInt(1, 30))) : null,
    });
  }
  for (let i = 0; i < 6; i++) {
    entryRows.push({
      entry_kind: "adjustment",
      amount_cents: randInt(500, 5000) * 100,
      description: pick(["Rounding adjustment", "Prior period correction"]),
      recorded_by: users.account_manager,
      recorded_at: iso(daysAgo(randInt(2, 30))),
      verified_by: rand() < 0.5 ? users.head_accountant : null,
      verified_at: rand() < 0.5 ? iso(daysAgo(randInt(1, 20))) : null,
    });
  }
  const entries = await insert("financial_entries", entryRows);
  log("P6", "financial_entries", entries.length);

  const disbRows = [];
  for (let i = 0; i < 10; i++) {
    const status = pick(["submitted", "approved", "released", "received", "paid", "rejected", "draft"]);
    disbRows.push({
      title: pick([
        "Vehicle acquisition fund",
        "Reconditioning disbursement",
        "Field case allowance",
        "Delivery fuel allocation",
      ]),
      amount_cents: randInt(10000, 500000) * 100,
      purpose: "Approved disbursement for operations.",
      status,
      requested_by: pick([users.confidential_informant, users.account_manager]),
      approved_by: status !== "draft" && status !== "submitted" && status !== "rejected" ? users.head_accountant : null,
      released_by: ["released", "received", "paid"].includes(status) ? users.head_accountant : null,
      received_by: ["received", "paid"].includes(status)
        ? pick([users.confidential_informant, users.account_manager])
        : null,
      notes: "Fund handoff recorded without online transfer.",
    });
  }
  const disb = await insert("disbursement_requests", disbRows, "id, status, requested_by");
  log("P6", "disbursement_requests", disb.length);

  const evtRows = [];
  for (const d of disb) {
    const flow =
      {
        submitted: ["submitted"],
        approved: ["submitted", "approved"],
        released: ["submitted", "approved", "released"],
        received: ["submitted", "approved", "released", "received"],
        paid: ["submitted", "approved", "released", "received", "paid"],
        rejected: ["submitted", "rejected"],
        draft: [],
      }[d.status] ?? [];
    for (const ev of flow) {
      evtRows.push({
        disbursement_id: d.id,
        event_kind: ev,
        actor_id: ev === "submitted" ? d.requested_by : users.head_accountant,
        notes: `Disbursement ${ev}`,
      });
    }
  }
  const events = await insert("disbursement_events", evtRows);
  log("P6", "disbursement_events", events.length);

  const reportRows = [];
  const kinds = ["attendance", "payroll", "disbursement", "expense", "revenue", "inventory", "sales", "management"];
  for (let i = 0; i < 12; i++) {
    reportRows.push({
      report_kind: kinds[i % kinds.length],
      title: `${kinds[i % kinds.length].charAt(0).toUpperCase() + kinds[i % kinds.length].slice(1)} report — ${dateOnly(addDays(now, -randInt(2, 30)))}`,
      description: "Generated from live platform records.",
      submitted_by: pick([users.account_manager, users.head_accountant]),
      status: pick(["submitted", "reviewed", "draft"]),
      period_start: dateOnly(addDays(now, -30)),
      period_end: dateOnly(addDays(now, -1)),
    });
  }
  const reports = await insert("reports", reportRows);
  log("P6", "reports", reports.length);

  const annRows = [
    {
      title: "Company-wide: New Office Hours",
      body: "Starting next month, office hours are 8:00 AM to 5:00 PM.",
      status: "published",
    },
    {
      title: "Year-End Inventory Week",
      body: "All hands on deck for the year-end inventory count.",
      status: "published",
    },
    {
      title: "Holiday Schedule Announcement",
      body: "Please check the holiday calendar for upcoming closures.",
      status: "published",
    },
    {
      title: "New Payroll Schedule",
      body: "Payslips will be released on the 15th and 30th of each month.",
      status: "draft",
    },
    { title: "Safety Reminder", body: "Always log duty checks before closing the lot.", status: "expired" },
    {
      title: "Welcome Our New Mechanics",
      body: "Please welcome our two newest mechanics joining the team.",
      status: "published",
    },
  ];
  const annRowsFull = annRows.map((a) => ({
    ...a,
    author_id: users.ceo,
    published_at:
      a.status === "published" ? iso(daysAgo(randInt(2, 20))) : a.status === "expired" ? iso(daysAgo(40)) : null,
    expires_at:
      a.status === "expired"
        ? iso(daysAgo(10))
        : a.status === "published" && rand() < 0.4
          ? iso(addDays(now, 30))
          : null,
  }));
  const announcements = await insert("announcements", annRowsFull);
  log("P6", "announcements", announcements.length);
}

// ---------------------------------------------------------------------------
// 11. Phase 6 — payroll (private compensation via SQL, runs, payslips, items)
// ---------------------------------------------------------------------------
async function seedPayroll(users) {
  const staff = [
    { role: "mechanic", id: users.mechanic, salary: 18000 },
    { role: "sales_manager", id: users.sales_manager, salary: 26000 },
    { role: "marketing_specialist", id: users.marketing_specialist, salary: 22000 },
    { role: "account_manager", id: users.account_manager, salary: 30000 },
    { role: "head_accountant", id: users.head_accountant, salary: 32000 },
    { role: "confidential_informant", id: users.confidential_informant, salary: 20000 },
    { role: "ceo", id: users.ceo, salary: 60000 },
    { role: "head_security", id: users.head_security, salary: 16000 },
  ];

  // Private schema: wipe + insert via the linked Supabase CLI (not exposed to the API).
  const dir = mkdtempSync(join(tmpdir(), "gce-seed-"));
  const sqlPath = join(dir, "compensation.sql");
  const values = staff
    .map((s) => `('${s.id}', ${s.salary * 100}, '2026-01-01', NULL, '${users.account_manager}', now())`)
    .join(",\n");
  writeFileSync(
    sqlPath,
    `DELETE FROM private.staff_compensation;\nINSERT INTO private.staff_compensation (employee_id, base_salary_cents, effective_from, effective_until, created_by, created_at)\nVALUES\n${values};\n`,
  );
  try {
    execSync(`npx supabase db query --linked --file "${sqlPath}"`, {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: true,
    });
    log("P6", "staff_compensation", staff.length);
  } catch (e) {
    console.warn(
      "  WARN: staff_compensation insert failed (private schema). Run manually:\n  npx supabase db query --linked --file " +
        sqlPath,
    );
    console.warn("  " + String(e.stderr ?? e.message).slice(0, 300));
  }

  // Payroll runs: 2 draft, 1 approved, 1 finalized (distinct periods).
  const runDefs = [
    { status: "draft", start: dateOnly(addDays(now, -30)), end: dateOnly(addDays(now, -1)) },
    { status: "draft", start: dateOnly(addDays(now, -60)), end: dateOnly(addDays(now, -31)) },
    { status: "approved", start: dateOnly(addDays(now, -90)), end: dateOnly(addDays(now, -61)) },
    { status: "finalized", start: dateOnly(addDays(now, -120)), end: dateOnly(addDays(now, -91)) },
  ];
  const runs = [];
  for (const def of runDefs) {
    const { data, error } = await admin
      .from("payroll_runs")
      .insert({
        period_start: def.start,
        period_end: def.end,
        status: def.status,
        prepared_by: users.account_manager,
        total_gross_cents: 0,
        total_deductions_cents: 0,
        total_net_cents: 0,
        notes: "Seed payroll run.",
      })
      .select("id")
      .single();
    if (error) throw error;
    runs.push({ id: data.id, ...def });
  }
  log("P6", "payroll_runs", runs.length);

  // Payslips per run.
  let grossTotal = 0;
  for (const run of runs) {
    for (const s of staff) {
      const gross = s.salary * 100;
      const deductions = Math.round(s.salary * 100 * 0.08);
      const { data, error } = await admin
        .from("payslips")
        .insert({
          payroll_run_id: run.id,
          employee_id: s.id,
          gross_cents: gross,
          deductions_cents: deductions,
          net_cents: gross - deductions,
          status: run.status === "finalized" ? "finalized" : "draft",
          finalized_at: run.status === "finalized" ? iso(daysAgo(85)) : null,
          payment_status: run.status === "finalized" ? pick(["pending", "paid"]) : "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      grossTotal += gross;

      const items = [
        {
          item_kind: "earning",
          label: "Base salary",
          amount_cents: gross,
          source_value: String(s.salary * 100),
          calculation_note: `Monthly base salary ${s.salary.toLocaleString()}`,
        },
        {
          item_kind: "deduction",
          label: "SSS contribution",
          amount_cents: Math.round(gross * 0.04),
          source_value: "standard",
          calculation_note: "4% employee share",
        },
        {
          item_kind: "deduction",
          label: "PhilHealth",
          amount_cents: Math.round(gross * 0.02),
          source_value: "standard",
          calculation_note: "2% employee share",
        },
        {
          item_kind: "deduction",
          label: "Withholding tax",
          amount_cents: Math.round(gross * 0.02),
          source_value: "entered",
          calculation_note: "Entered by Account Manager",
        },
      ];
      const { error: itemErr } = await admin
        .from("payslip_items")
        .insert(items.map((it) => ({ ...it, payslip_id: data.id })));
      if (itemErr) throw itemErr;
    }
  }
  const { count: payslipCount } = await admin.from("payslips").select("id", { count: "exact", head: true });
  const { count: itemCount } = await admin.from("payslip_items").select("id", { count: "exact", head: true });
  log("P6", "payslips", payslipCount ?? 0);
  log("P6", "payslip_items", itemCount ?? 0);

  // Approvals for the approved + finalized runs.
  const approvalRows = [];
  for (const run of runs) {
    if (run.status === "approved" || run.status === "finalized") {
      approvalRows.push(
        {
          payroll_run_id: run.id,
          sequence: 1,
          reviewer_id: users.head_accountant,
          decision: "approved",
          notes: "Reviewed by Head Accountant",
        },
        { payroll_run_id: run.id, sequence: 2, reviewer_id: users.ceo, decision: "approved", notes: "Approved by CEO" },
      );
    }
  }
  const approvals = await insert("payroll_approvals", approvalRows);
  log("P6", "payroll_approvals", approvals.length);
}

// ---------------------------------------------------------------------------
// 12. Phase 6 — security duty checks, supplier messages, roadmap
// ---------------------------------------------------------------------------
async function seedOps(users, suppliers) {
  const dutyRows = [];
  for (let d = 24; d >= 1; d--) {
    const date = addDays(now, -d);
    if (date.getDay() === 0) continue;
    dutyRows.push({
      security_id: users.head_security,
      duty_date: dateOnly(date),
      before_image_path: `seed/security/${users.head_security}/${dateOnly(date)}/before.png`,
      after_image_path: rand() < 0.7 ? `seed/security/${users.head_security}/${dateOnly(date)}/after.png` : null,
      notes: "Standard lot inspection.",
      status: pick(["completed", "in_progress", "pending"]),
      completed_at: rand() < 0.7 ? iso(date) : null,
    });
  }
  const duties = await insert("security_duty_checks", dutyRows);
  log("P6", "security_duty_checks", duties.length);

  const approvedSupplier = suppliers.find((s) => s.state === "approved");
  const msgRows = [];
  if (approvedSupplier) {
    const lines = [
      "Good day, we have new units available for your inventory.",
      "Can you share the current price list?",
      "We received your latest shipment.",
      "The documents for the next delivery are ready.",
      "Please confirm the delivery schedule.",
      "Thank you — we will prepare the requirements.",
    ];
    for (let i = 0; i < 20; i++) {
      const fromCeo = i % 2 === 0;
      msgRows.push({
        supplier_id: approvedSupplier.id,
        sender_id: fromCeo ? users.ceo : users.supplier,
        message_text: pick(lines),
        read_at: rand() < 0.6 ? iso(daysAgo(randInt(0, 8))) : null,
      });
    }
  }
  const messages = await insert("supplier_messages", msgRows);
  log("P6", "supplier_messages", messages.length);

  const roadmap = [
    {
      kind: "initiative",
      title: "Customer Experience 2026",
      status: "in_progress",
      priority: "high",
      quarter: "Q2",
      year: 2026,
      team: "Platform",
    },
    {
      kind: "epic",
      parent: 0,
      title: "Enhanced Vehicle Discovery",
      status: "in_progress",
      priority: "high",
      quarter: "Q2",
      year: 2026,
      team: "Platform",
    },
    {
      kind: "feature",
      parent: 1,
      title: "360° vehicle viewer",
      status: "completed",
      priority: "high",
      quarter: "Q2",
      year: 2026,
      team: "Platform",
    },
    {
      kind: "feature",
      parent: 1,
      title: "Advanced search filters",
      status: "in_progress",
      priority: "medium",
      quarter: "Q3",
      year: 2026,
      team: "Platform",
    },
    {
      kind: "epic",
      parent: 0,
      title: "Smart Recommendations",
      status: "planned",
      priority: "medium",
      quarter: "Q3",
      year: 2026,
      team: "Data",
    },
    {
      kind: "feature",
      parent: 4,
      title: "Budget-based ranking",
      status: "completed",
      priority: "medium",
      quarter: "Q3",
      year: 2026,
      team: "Data",
    },
    {
      kind: "feature",
      parent: 4,
      title: "Accuracy feedback loop",
      status: "planned",
      priority: "low",
      quarter: "Q4",
      year: 2026,
      team: "Data",
    },
    {
      kind: "initiative",
      title: "Operational Excellence",
      status: "planned",
      priority: "medium",
      quarter: "Q3",
      year: 2026,
      team: "Ops",
    },
    {
      kind: "epic",
      parent: 7,
      title: "Payroll Automation",
      status: "in_progress",
      priority: "high",
      quarter: "Q3",
      year: 2026,
      team: "Finance",
    },
    {
      kind: "feature",
      parent: 8,
      title: "Compensation entry UI",
      status: "completed",
      priority: "high",
      quarter: "Q3",
      year: 2026,
      team: "Finance",
    },
    {
      kind: "feature",
      parent: 8,
      title: "Payslip payment tracking",
      status: "completed",
      priority: "high",
      quarter: "Q3",
      year: 2026,
      team: "Finance",
    },
    {
      kind: "epic",
      parent: 7,
      title: "Field Operations Hub",
      status: "planned",
      priority: "medium",
      quarter: "Q4",
      year: 2026,
      team: "Ops",
    },
    {
      kind: "feature",
      parent: 11,
      title: "Case expense tracking",
      status: "in_progress",
      priority: "medium",
      quarter: "Q4",
      year: 2026,
      team: "Ops",
    },
    {
      kind: "initiative",
      title: "Supplier Ecosystem",
      status: "planned",
      priority: "medium",
      quarter: "Q4",
      year: 2026,
      team: "Sales",
    },
    {
      kind: "epic",
      parent: 13,
      title: "Supplier Portal",
      status: "on_hold",
      priority: "low",
      quarter: "Q4",
      year: 2026,
      team: "Sales",
    },
    {
      kind: "feature",
      parent: 14,
      title: "Supplier self-service dashboard",
      status: "on_hold",
      priority: "low",
      quarter: "Q4",
      year: 2026,
      team: "Sales",
    },
    {
      kind: "feature",
      parent: 14,
      title: "CEO–supplier messaging",
      status: "completed",
      priority: "medium",
      quarter: "Q4",
      year: 2026,
      team: "Sales",
    },
  ];
  const items = [];
  for (const r of roadmap) {
    const { data, error } = await admin
      .from("roadmap_items")
      .insert({
        parent_id: r.parent !== undefined ? (items[r.parent]?.id ?? null) : null,
        kind: r.kind,
        title: r.title,
        description: `${r.title} — tracked on the product roadmap.`,
        status: r.status,
        priority: r.priority,
        quarter: r.quarter,
        year: r.year,
        team: r.team,
        created_by: users.ceo,
      })
      .select("id")
      .single();
    if (error) throw error;
    items.push(data);
  }
  log("P6", "roadmap_items", items.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== GCE seed-data ===");
  console.log(`Connected to ${supabaseUrl}\n`);

  const users = await loadUsers();
  console.log("Users loaded: 10 seed accounts found\n");

  console.log("Wiping previously seeded rows...");
  for (const table of WIPE_TABLES) {
    try {
      await wipe(table);
    } catch (e) {
      console.warn(`  wipe ${table}: ${e.message}`);
    }
  }
  console.log("");

  console.log("Seeding suppliers...");
  const suppliers = await seedSuppliers(users);

  console.log("Seeding vehicles + media...");
  const vehicles = await seedVehicles(users);

  console.log("Seeding inspection checklist...");
  const checklist = await seedChecklistTemplate();

  console.log("Seeding inspections, repairs, documents, price proposals...");
  await seedInspections(users, vehicles, checklist);

  console.log("Seeding inquiries and conversations...");
  await seedInquiries(users, vehicles);

  console.log("Seeding transactions and installments...");
  const { created } = await seedTransactions(users, vehicles);
  const txIds = created.map((t) => t.id);

  console.log("Seeding favourites, content, recommendations...");
  await seedFavourites(users, vehicles);
  await seedContent(users, vehicles);
  await seedRecommendations(users, vehicles);

  console.log("Seeding staff records (attendance, requests, reviews)...");
  await seedStaffRecords(users);

  console.log("Seeding finance, disbursements, reports, announcements...");
  await seedFinance(users, txIds);

  console.log("Seeding payroll...");
  await seedPayroll(users);

  console.log("Seeding security duties, supplier messages, roadmap...");
  await seedOps(users, suppliers);

  console.log("\n=== Seed complete ===");
  console.log("Roles were NOT reassigned. If roles are missing, run:");
  console.log("  npx supabase db query --linked --file scripts/seed-roles.sql");
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message);
  process.exit(1);
});
