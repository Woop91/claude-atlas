import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,       // webServer is shared; tests share state less safely in parallel
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
        launchOptions: { args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"] },
      },
    },
  ],
  webServer: {
    command: "npx http-server -s -p 4173 --cache -1",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
