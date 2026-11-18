import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  // The T01 fixtures are 2 MB phone-photo-sized files, so a multi-role test needs more than 30 s.
  timeout: 120_000,
  retries: 0,
  // The specs share one Supabase project and one customer account; cleanup in one spec (archiving test
  // cars, resetting the customer's standing) would break a spec running beside it.
  workers: 1,
  use: {
    // E2E_BASE_URL lets a second checkout run on another port (e.g. a worktree on :3001).
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
  },
});
