// One-time build of the bundled PSGC address data. Run with `node scripts/build-psgc.mjs`.
// Source: https://psgc.gitlab.io (Philippine Standard Geographic Code, 2024 update).
// The app fetches these files from /psgc/ at runtime, so it needs no network access of its own.

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const API = "https://psgc.gitlab.io/api";
const OUT_DIR = join(process.cwd(), "public", "psgc");
const BARANGAY_DIR = join(OUT_DIR, "barangays");
const CONCURRENCY = 8;
const ATTEMPTS = 3;

async function fetchJson(path) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${API}/${path}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === ATTEMPTS) throw new Error(`${path}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`${path}: unreachable`);
}

function byName(rows) {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, "en"));
}

async function writeJson(path, rows) {
  await writeFile(path, `${JSON.stringify(rows)}\n`, "utf8");
  return rows;
}

async function pool(items, run) {
  let index = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await run(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  console.log("Fetching regions, provinces and cities/municipalities...");
  const [regions, provinces, cities] = await Promise.all([
    fetchJson("regions.json"),
    fetchJson("provinces.json"),
    fetchJson("cities-municipalities.json"),
  ]);

  await mkdir(BARANGAY_DIR, { recursive: true });

  await writeJson(join(OUT_DIR, "regions.json"), byName(regions.map((row) => ({ code: row.code, name: row.name }))));
  await writeJson(
    join(OUT_DIR, "provinces.json"),
    byName(provinces.map((row) => ({ code: row.code, name: row.name, regionCode: row.regionCode }))),
  );
  await writeJson(
    join(OUT_DIR, "cities.json"),
    byName(
      cities.map((row) => ({
        code: row.code,
        name: row.name,
        regionCode: row.regionCode,
        provinceCode: row.provinceCode || null,
      })),
    ),
  );

  console.log(`Fetching barangays for ${cities.length} cities and municipalities...`);
  let done = 0;
  const failed = [];
  await pool(cities, async (city) => {
    try {
      const barangays = await fetchJson(`cities-municipalities/${city.code}/barangays.json`);
      await writeJson(
        join(BARANGAY_DIR, `${city.code}.json`),
        byName(barangays.map((row) => ({ code: row.code, name: row.name }))),
      );
    } catch (error) {
      failed.push(`${city.code} ${city.name}: ${error.message}`);
    }
    done += 1;
    if (done % 200 === 0) console.log(`  ${done}/${cities.length}`);
  });

  if (failed.length > 0) {
    console.error(`${failed.length} barangay fetches failed:`);
    for (const line of failed) console.error(`  ${line}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Done. ${regions.length} regions, ${provinces.length} provinces, ${cities.length} cities.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
