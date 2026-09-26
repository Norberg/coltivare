import { defineConfig } from "@playwright/test";
import { browserArguments } from "./tests/browser-options";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    launchOptions: { args: browserArguments },
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js build && node scripts/static-server.mjs",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
