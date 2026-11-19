// Writes out/.htaccess after the static export. Run: npm run build:static

import { buildHtaccess } from "../lib/routing/htaccess";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const OUT = join(process.cwd(), "out");

/**
 * Folders that hold the `_` placeholder of an [id] page, relative to out/ (e.g. "vehicles"). The catch-all
 * not-found placeholders (out/_ and the template preview's) are not id pages: Apache answers 404 there.
 */
function dynamicBases(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name === "_next" || !statSync(path).isDirectory()) continue;
    const base = relative(OUT, dir).replaceAll("\\", "/");
    if (name === "_") {
      if (base !== "" && !base.startsWith("template")) found.push(base);
    } else found.push(...dynamicBases(path));
  }
  return found;
}

if (!existsSync(OUT)) throw new Error("out/ not found: run the static build first.");
const bases = [...new Set(dynamicBases(OUT))].sort();
writeFileSync(join(OUT, ".htaccess"), buildHtaccess(bases));
console.log(`out/.htaccess written (${bases.length} [id] routes: ${bases.join(", ")})`);
