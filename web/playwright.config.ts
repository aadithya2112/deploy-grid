import { defineConfig, devices } from "@playwright/test"

const appPort = 3001
const apiPort = 4010

export default defineConfig({
  testDir: "./tests/e2e/specs",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${appPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: `bun run ./tests/e2e/mock-api-server.ts`,
      port: apiPort,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `E2E_TEST_MODE=1 E2E_TEST_USER_ID=e2e-user DEPLOY_GRID_API_URL=http://127.0.0.1:${apiPort} bunx next dev --hostname 127.0.0.1 --port ${appPort}`,
      port: appPort,
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
})
