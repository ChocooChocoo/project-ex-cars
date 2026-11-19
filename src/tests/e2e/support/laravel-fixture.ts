import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Phase 5: test data for the specs comes from Laravel (`php artisan e2e:fixture`), which writes to the same database
// the API reads. The command refuses to run outside local/testing/staging.
// Against staging, set E2E_FIXTURE_CMD to a command prefix that runs artisan there, e.g.
// `ssh -p 65002 -o BatchMode=yes user@host "cd gce-api && php artisan"`; `e2e:fixture <action> <args>` is appended.
const BACKEND = join(process.cwd(), "backend");
const remote = process.env.E2E_FIXTURE_CMD;

export function canUseLaravelFixtures(): boolean {
  return Boolean(remote) || existsSync(join(BACKEND, "artisan"));
}

export function laravelFixture(action: string, ...args: (string | number)[]): string {
  const argv = [action, ...args.map(String)];
  if (remote) {
    // The remote command goes through a shell, so only plain tokens (ids, numbers, labels) are allowed.
    const bad = argv.find((a) => !/^[\w.:@-]+$/.test(a));
    if (bad !== undefined) throw new Error(`Unsafe fixture argument for a remote run: ${bad}`);
    return execSync(`${remote} e2e:fixture ${argv.join(" ")}`, { encoding: "utf8" }).trim();
  }
  return execFileSync("php", ["artisan", "e2e:fixture", ...argv], { cwd: BACKEND, encoding: "utf8" }).trim();
}
