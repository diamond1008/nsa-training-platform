import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const apiBaseURL = process.env.E2E_API_BASE_URL ?? "http://localhost:8080/api/v1";
const webPort = new URL(baseURL).port || "5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${webPort}`,
        url: baseURL,
        reuseExistingServer: process.env.E2E_REUSE_WEB_SERVER === "1",
        env: { VITE_API_BASE_URL: apiBaseURL },
        timeout: 120_000,
      },
});
