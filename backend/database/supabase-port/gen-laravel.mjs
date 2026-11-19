// Generate Laravel MySQL migrations from the PGlite replay of supabase/migrations.
// Usage: node gen-laravel.mjs <backend/database/migrations dir>
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2];
const j = (n) => JSON.parse(readFileSync(new URL(`./${n}.json`, import.meta.url), "utf8"));
const cols = j("columns");
const cons = j("constraints");
const idx = j("indexes");

const tname = (s, t) => t; // private.* tables live in the same MySQL database
const ref = (r) => (r === "auth.users" ? "users" : r.replace(/^(public|private)\./, ""));
const tables = [...new Map(cols.map((c) => [`${c.s}.${c.t}`, { s: c.s, t: c.t }])).values()];
const colsOf = (t) => cols.filter((c) => c.s === t.s && c.t === t.t);
const consOf = (t, type) => cons.filter((k) => k.s === t.s && k.t === t.t && (!type || k.type === type));
const keyCols = (def) => (def.match(/\(([^)]*)\)/)?.[1] ?? "").split(",").map((x) => x.trim());

// Columns that must be VARCHAR: in a key/index, or carrying a default (MySQL TEXT has no literal default).
const varchar = new Set();
for (const k of cons) {
  if (["p", "u", "f"].includes(k.type)) for (const c of keyCols(k.def)) varchar.add(`${k.t}.${c}`);
  if (k.type === "f") {
    const [, rt, rc] = k.def.match(/REFERENCES (\S+)\((\w+)\)/);
    varchar.add(`${ref(rt)}.${rc}`);
  }
  if (k.type === "c" && /= ANY|<> ALL/.test(k.def)) for (const m of k.def.matchAll(/\((\w+) (?:=|<>) (?:ANY|ALL)/g)) varchar.add(`${k.t}.${m[1]}`);
}
for (const i of idx) {
  const m = i.def.match(/USING btree \((.*?)\)(?: WHERE|$)/);
  if (m) for (const c of m[1].split(",")) varchar.add(`${i.t}.${c.trim().split(" ")[0]}`);
}

function colDef(c) {
  const key = `${c.t}.${c.c}`;
  let s;
  switch (c.udt) {
    case "uuid": s = `$table->uuid('${c.c}')`; break;
    case "text": s = varchar.has(key) || c.d ? `$table->string('${c.c}')` : `$table->text('${c.c}')`; break;
    case "int8": s = `$table->bigInteger('${c.c}')`; break;
    case "int4": s = `$table->integer('${c.c}')`; break;
    case "int2": s = `$table->smallInteger('${c.c}')`; break;
    case "bool": s = `$table->boolean('${c.c}')`; break;
    case "float8": s = `$table->double('${c.c}')`; break;
    case "date": s = `$table->date('${c.c}')`; break;
    case "time": s = `$table->time('${c.c}')`; break;
    case "timestamptz": s = `$table->dateTime('${c.c}', 6)`; break;
    case "jsonb": case "_int2": s = `$table->json('${c.c}')`; break;
    case "numeric": s = `$table->decimal('${c.c}', ${c.p ?? 12}, ${c.sc ?? 2})`; break;
    default: throw new Error(`type ${c.udt} ${key}`);
  }
  if (c.g === "ALWAYS") return null; // generated columns handled by hand below
  if (c.n === "YES") s += "->nullable()";
  const d = c.d;
  if (d === "gen_random_uuid()") s += "->default(DB::raw('(UUID())'))";
  else if (d === "now()") s += "->useCurrent()";
  else if (d === "CURRENT_DATE") s += "->default(DB::raw('(CURRENT_DATE)'))";
  else if (d === "'[]'::jsonb") s += "->default(DB::raw('(JSON_ARRAY())'))";
  else if (d === "true" || d === "false") s += `->default(${d})`;
  else if (d && /^'.*'::text$/.test(d)) s += `->default('${d.slice(1, d.indexOf("'::"))}')`;
  else if (d && /^-?\d+(\.\d+)?$/.test(d)) s += `->default(${d})`;
  else if (d) throw new Error(`default ${d} ${key}`);
  return `${s};`;
}

// Hand-mapped generated columns.
const generated = {
  "attendance_entries.hours_worked":
    "$table->decimal('hours_worked', 4, 2)->nullable()->storedAs('CASE WHEN time_in IS NOT NULL AND time_out IS NOT NULL THEN ROUND(TIMESTAMPDIFF(MICROSECOND, time_in, time_out) / 3600000000, 2) ELSE NULL END');",
  // initcap() has no MySQL equivalent; RbacPermission fills access_label on save.
  "rbac_permissions.access_label": "$table->string('access_label')->nullable();",
  "rbac_permissions.permission_key": "$table->string('permission_key')->storedAs(\"CONCAT(access_area_key, '.', action_key)\");",
};

// Partial unique indexes: invisible virtual discriminator column + unique key (NULL rows never collide).
const conditionalUnique = {
  disbursement_requests: [["uq_live_field_case_id", "char(36)", "IF(field_case_id IS NOT NULL AND status <> 'rejected', field_case_id, NULL)", ["uq_live_field_case_id"], "disbursement_requests_one_live_field_budget"]],
  payment_records: [
    ["uq_live_installment_id", "char(36)", "IF(installment_id IS NOT NULL AND rejected_at IS NULL, installment_id, NULL)", ["transaction_id", "uq_live_installment_id"], "payment_records_live_installment_unique"],
    ["uq_once_kind", "varchar(255)", "IF(installment_id IS NULL AND rejected_at IS NULL AND payment_kind <> 'reschedule_fee', payment_kind, NULL)", ["transaction_id", "uq_once_kind", "part_no"], "payment_records_once_per_kind_part"],
  ],
  reconditioning_jobs: [["uq_open_vehicle_id", "char(36)", "IF(state <> 'completed', vehicle_id, NULL)", ["uq_open_vehicle_id"], "reconditioning_jobs_one_open_per_vehicle"]],
  transactions: [["uq_active_vehicle_id", "char(36)", "IF(queue_state = 'active', vehicle_id, NULL)", ["uq_active_vehicle_id"], "transactions_one_active_buyer_per_vehicle"]],
  vehicle_price_proposals: [["uq_pending_vehicle_id", "char(36)", "IF(decision = 'pending', vehicle_id, NULL)", ["uq_pending_vehicle_id", "proposal_kind"], "vehicle_price_proposals_one_pending_per_kind"]],
  viewing_arrangements: [["uq_slot_vehicle_id", "char(36)", "IF(confirmation_state IN ('pending', 'confirmed') AND arrangement_kind = 'gce_visit', vehicle_id, NULL)", ["uq_slot_vehicle_id", "schedule"], "viewing_arrangements_gce_visit_slot_lock"]],
};

const php = (body, down) => `<?php

use Illuminate\\Database\\Migrations\\Migration;
use Illuminate\\Database\\Schema\\Blueprint;
use Illuminate\\Support\\Facades\\DB;
use Illuminate\\Support\\Facades\\Schema;

// Generated from the final state of supabase/migrations (116 files, last 20261116140000_t11_recondition_known_issues.sql).
// See docs/implementation-plan/laravel-mysql-migration/phase-2.md for the mapping rules.
return new class extends Migration
{
    public function up(): void
    {
${body}
    }

    public function down(): void
    {
${down}
    }
};
`;

// ---------- 1. tables ----------
let body = "";
const dropOrder = [];
for (const t of tables) {
  const name = tname(t.s, t.t);
  dropOrder.push(name);
  body += `        Schema::create('${name}', function (Blueprint $table) {\n`;
  for (const c of colsOf(t)) {
    const g = generated[`${c.t}.${c.c}`];
    body += `            ${g ?? colDef(c)}\n`;
  }
  for (const [col, , expr] of conditionalUnique[name] ?? []) {
    const type = col === "uq_once_kind" ? "string" : "uuid";
    // RTRIM: MariaDB will not index a generated column that returns a CHAR column as-is.
    const vexpr = type === "uuid" ? expr.replace(/, (\w+), NULL\)$/, ", RTRIM($1), NULL)") : expr;
    body += `            $table->${type}('${col}')->nullable()->virtualAs("${vexpr}")->invisible();\n`;
  }
  const pk = consOf(t, "p")[0];
  body += `            $table->primary([${keyCols(pk.def).map((c) => `'${c}'`).join(", ")}]);\n`;
  for (const u of consOf(t, "u")) body += `            $table->unique([${keyCols(u.def).map((c) => `'${c}'`).join(", ")}], '${u.name}');\n`;
  for (const [, , , ucols, uname] of conditionalUnique[name] ?? []) body += `            $table->unique([${ucols.map((c) => `'${c}'`).join(", ")}], '${uname}');\n`;
  body += "        });\n\n";
}
// Plain and expression indexes (partial predicates dropped; unique partial ones are covered above).
const skippedIdx = [];
for (const i of idx) {
  if (cons.some((k) => k.name === i.name)) continue;
  const m = i.def.match(/^CREATE (UNIQUE )?INDEX (\S+) ON \S+ USING btree \((.*?)\)( WHERE .*)?$/);
  if (!m) throw new Error(i.def);
  const [, uniq, iname, colsExpr, where] = m;
  if (uniq && where) {
    if (i.t === "inquiries") body += `        DB::statement('CREATE UNIQUE INDEX ${iname} ON inquiries (transaction_id)');\n`;
    else skippedIdx.push(`${i.t}: ${i.def} (replaced by conditional unique)`);
    continue;
  }
  const expr = colsExpr.includes("COALESCE")
    ? colsExpr.replace(/, COALESCE\(end_date, start_date\)/, "") // MariaDB has no functional indexes
    : colsExpr.split(", ").map((p) => p.replace(/^(\w+)/, "`$1`")).join(", ");
  body += `        DB::statement('CREATE INDEX ${iname} ON ${i.t} (${expr})');\n`;
  if (where) skippedIdx.push(`${i.t}.${iname}: partial predicate${where} dropped (plain index)`);
}
const down1 = `        Schema::disableForeignKeyConstraints();\n${dropOrder.map((n) => `        Schema::dropIfExists('${n}');`).join("\n")}\n        Schema::enableForeignKeyConstraints();`;
writeFileSync(`${out}/2026_11_18_000001_create_gce_tables.php`, php(body.trimEnd(), down1));

// ---------- 2. foreign keys ----------
let fk = "";
let fkDown = "";
for (const t of tables) {
  const fks = consOf(t, "f");
  if (!fks.length) continue;
  fk += `        Schema::table('${t.t}', function (Blueprint $table) {\n`;
  fkDown += `        Schema::table('${t.t}', function (Blueprint $table) {\n`;
  for (const f of fks) {
    const m = f.def.match(/^FOREIGN KEY \((.*?)\) REFERENCES (\S+)\((.*?)\)(?: ON DELETE (CASCADE|SET NULL|RESTRICT))?$/);
    if (!m) throw new Error(f.def);
    const [, c, rt, rc, act] = m;
    let s = `            $table->foreign('${c}', '${f.name}')->references('${rc}')->on('${ref(rt)}')`;
    if (act === "CASCADE") s += "->cascadeOnDelete()";
    else if (act === "SET NULL") s += "->nullOnDelete()";
    else if (act === "RESTRICT") s += "->restrictOnDelete()";
    fk += `${s};\n`;
    fkDown += `            $table->dropForeign('${f.name}');\n`;
  }
  fk += "        });\n\n";
  fkDown += "        });\n";
}
writeFileSync(`${out}/2026_11_18_000002_add_gce_foreign_keys.php`, php(fk.trimEnd(), fkDown.trimEnd()));

// ---------- 3. CHECK constraints ----------
const fkActionCols = new Set(
  cons.filter((k) => k.type === "f" && / ON DELETE (CASCADE|SET NULL)/.test(k.def)).flatMap((k) => keyCols(k.def).map((c) => `${k.t}.${c}`)),
);
const toMysql = (def) =>
  def
    .replace(/ NOT VALID$/, "")
    .replace(/'(-?\d+)'::integer/g, "$1")
    .replace(/\((-?\d+(?:\.\d+)?)\)::(numeric|double precision|smallint|integer)/g, "$1")
    .replace(/::(text|numeric|double precision|smallint|integer)/g, "")
    .replace(/(\w+) = ANY \(ARRAY\[(.*?)\]\)/g, "$1 IN ($2)")
    .replace(/(\w+) <> ALL \(ARRAY\[(.*?)\]\)/g, "$1 NOT IN ($2)")
    .replace(/btrim\(/g, "TRIM(")
    .replace(/length\(TRIM\(BOTH FROM (\w+)\)\)/g, "CHAR_LENGTH(TRIM($1))")
    .replace(/(\w+) ~ ('[^']*')/g, "($1 REGEXP $2)") // MariaDB rejects REGEXP_LIKE in CHECK
    .replace(/\brank\b/g, "`rank`");
let chk = "";
let chkDown = "";
const skippedChecks = [];
for (const k of cons.filter((x) => x.type === "c")) {
  const used = [...k.def.matchAll(/\b([a-z_]+)\b/g)].map((m) => `${k.t}.${m[1]}`).filter((x) => fkActionCols.has(x));
  if (used.length) { skippedChecks.push(`${k.t}.${k.name}: ${k.def} (column ${used[0].split(".")[1]} has an FK delete action; enforce in app)`); continue; }
  if (/cardinality|<@/.test(k.def)) { skippedChecks.push(`${k.t}.${k.name}: ${k.def} (array check; enforce JSON shape in app)`); continue; }
  const sql = toMysql(k.def).replace(/'/g, "\\'");
  chk += `        DB::statement('ALTER TABLE ${k.t} ADD CONSTRAINT ${k.name} ${sql}');\n`;
  chkDown += `        DB::statement('ALTER TABLE ${k.t} DROP CONSTRAINT ${k.name}');\n`;
}
writeFileSync(`${out}/2026_11_18_000003_add_gce_check_constraints.php`, php(chk.trimEnd(), chkDown.trimEnd()));

writeFileSync(new URL("./skipped.txt", import.meta.url), [...skippedChecks, ...skippedIdx].join("\n") + "\n");
console.log("tables", tables.length, "fks", cons.filter((k) => k.type === "f").length, "checks written", chk.split("\n").length - 1, "skipped checks", skippedChecks.length, "index notes", skippedIdx.length);
