// Static production build for Hostinger Premium (Phase 4b): next build with output "export", then out/.htaccess.
import { spawnSync } from "node:child_process";

const env = { ...process.env, STATIC_EXPORT: "1" };
const run = (command) => {
  const result = spawnSync(command, { stdio: "inherit", shell: true, env });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("npx next build");
run("npx ts-node -P tsconfig.scripts.json src/scripts/generate-htaccess.ts");
