import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Phase 5: test data for the specs comes from the local Laravel app (`php artisan e2e:fixture`), which writes to
// the same MySQL database the API reads. The command refuses to run outside local/testing.
const BACKEND = join(process.cwd(), "backend");

export function canUseLaravelFixtures(): boolean {
  return existsSync(join(BACKEND, "artisan"));
}

export function laravelFixture(action: string, ...args: (string | number)[]): string {
  return execFileSync("php", ["artisan", "e2e:fixture", action, ...args.map(String)], {
    cwd: BACKEND,
    encoding: "utf8",
  }).trim();
}
