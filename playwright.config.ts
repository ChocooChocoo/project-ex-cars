import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/tests/e2e",
  timeout: 30000,
  retries: 0,
  // The specs share one Supabase project and one customer account; cleanup in one spec (archiving test
  // cars, resetting the customer's standing) would break a spec running beside it.
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
