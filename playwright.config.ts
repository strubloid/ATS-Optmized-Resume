import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:6688",
    trace: "retain-on-failure"
  },
  webServer: [
    {
      command: "npm run dev:api",
      url: "http://127.0.0.1:3333/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    },
    {
      command: "npm run dev:web",
      url: "http://127.0.0.1:6688",
      reuseExistingServer: !process.env.CI,
      timeout: 30000
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
