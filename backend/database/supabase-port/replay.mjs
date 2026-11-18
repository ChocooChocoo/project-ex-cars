// Replay supabase/migrations into in-memory Postgres (PGlite) with Supabase stubs, then dump the final schema.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const dir = process.argv[2], out = process.argv[3];
const db = new PGlite();
await db.exec(`
create role anon; create role authenticated; create role service_role; create role supabase_admin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, encrypted_password text,
  email_confirmed_at timestamptz, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint,
  allowed_mime_types text[], owner uuid, created_at timestamptz default now(), updated_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create publication supabase_realtime;
`);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  try { await db.exec(readFileSync(`${dir}/${f}`, "utf8").replace(/create\s+extension[^;]*pgcrypto[^;]*;/gi, "")); }
  catch (e) { console.log("FAIL", f, String(e.message).slice(0, 200)); }
}
console.log("applied", files.length, "last", files.at(-1));
const q = async (name, sql) => { const r = await db.query(sql); writeFileSync(`${out}/${name}.json`, JSON.stringify(r.rows, null, 1)); console.log(name, r.rows.length); };
await q("columns", `select table_schema s, table_name t, column_name c, ordinal_position o, data_type dt, udt_name udt, character_maximum_length len, numeric_precision p, numeric_scale sc, is_nullable n, column_default d, is_generated g, generation_expression ge
 from information_schema.columns where table_schema in ('public','private') and (table_schema, table_name) in (select table_schema, table_name from information_schema.tables where table_type='BASE TABLE') order by 1,2,4`);
await q("constraints", `select n.nspname s, cl.relname t, con.conname name, con.contype type, pg_get_constraintdef(con.oid) def, con.convalidated valid
 from pg_constraint con join pg_class cl on cl.oid=con.conrelid join pg_namespace n on n.oid=cl.relnamespace where n.nspname in ('public','private') order by 1,2,3`);
await q("indexes", `select schemaname s, tablename t, indexname name, indexdef def from pg_indexes where schemaname in ('public','private') order by 1,2,3`);
await q("functions", `select n.nspname s, p.proname name, pg_get_function_identity_arguments(p.oid) args, p.prosecdef definer, pg_get_functiondef(p.oid) def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by 1,2`);
await q("triggers", `select event_object_schema s, event_object_table t, trigger_name name, action_timing tm, string_agg(event_manipulation, ',') ev, action_statement st from information_schema.triggers where event_object_schema in ('public','private','auth') group by 1,2,3,4,6 order by 1,2,3`);
await q("policies", `select schemaname s, tablename t, policyname name, cmd, roles::text roles, qual, with_check from pg_policies where schemaname in ('public','private','storage') order by 1,2,3`);
await q("buckets", `select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id`);
const counts = {};
for (const t of (await db.query(`select table_schema s, table_name t from information_schema.tables where table_schema in ('public','private') and table_type='BASE TABLE'`)).rows) {
  const n = Number((await db.query(`select count(*)::int n from ${t.s}.${t.t}`)).rows[0].n);
  if (n) { counts[`${t.s}.${t.t}`] = n; const r = await db.query(`select * from ${t.s}.${t.t}`); writeFileSync(`${out}/rows-${t.t}.json`, JSON.stringify(r.rows, null, 1)); }
}
console.log("seeded by migrations", counts);
