// Phase 4b interim check (delete in Phase 8): builds the static export with everything that still needs the
// Next.js server set aside, so the pages already moved to the browser are proven to export and route.
// - Pages/layouts that still render on the server (Phases 5-7, Supabase) and route handlers (Phase 6) are
//   renamed to *.parked.
// - "use server" action files that still use Supabase are swapped for stubs that answer
//   { error: "Not in the static preview" }, because static export refuses any reachable Server Action.
// Every file is restored afterwards, even when the build fails. Types are not checked in this mode
// (STATIC_CHECK=1), because the stubs do not match the real return types.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const APP = join(SRC, "app");
const SERVER_ONLY =
  /export default async function|from "next\/headers"|lib\/supabase|server-session|from "@\/lib\/api\/server"|@\/lib\/auth\/guards|getSession\(/;

function files(dir, keep) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path, keep);
    return keep(name, path) ? [path] : [];
  });
}

const parked = files(APP, (name) => name === "page.tsx" || name === "layout.tsx" || name === "route.ts").filter(
  (file) => file.endsWith("route.ts") || SERVER_ONLY.test(readFileSync(file, "utf8")),
);
const stubbed = files(SRC, (name) => /\.tsx?$/.test(name) && !name.includes(".test.")).filter((file) =>
  /^"use server";/m.test(readFileSync(file, "utf8")),
);

const originals = new Map(stubbed.map((file) => [file, readFileSync(file, "utf8")]));
for (const file of parked) renameSync(file, `${file}.parked`);
for (const [file, source] of originals) {
  const names = [...source.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  writeFileSync(
    file,
    `"use client";\n// STATIC_CHECK stub (scripts/check-static-build.mjs); the real file is restored after the build.\n${names
      .map(
        (n) =>
          `export async function ${n}(..._args: unknown[]): Promise<any> {\n  return { error: "Not in the static preview" };\n}\n`,
      )
      .join("")}`,
  );
}
console.log(`Parked ${parked.length} route files and stubbed ${stubbed.length} Server Action files (Phases 5-7).`);

let status = 1;
try {
  status =
    spawnSync("node scripts/build-static.mjs", {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, STATIC_CHECK: "1" },
    }).status ?? 1;
} finally {
  for (const file of parked) renameSync(`${file}.parked`, file);
  for (const [file, source] of originals) writeFileSync(file, source);
  console.log(`Restored ${parked.length + stubbed.length} files.`);
}
process.exit(status);
