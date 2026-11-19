import { spawnSync } from "node:child_process";

const run = (command) => {
  const result = spawnSync(command, { stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run("npx next build");
run("npx ts-node -P tsconfig.scripts.json src/scripts/generate-htaccess.ts");
