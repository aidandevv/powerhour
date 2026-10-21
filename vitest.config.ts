import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["{app,components,lib,scripts,tests}/**/*.test.{ts,tsx}"],
    // Database suites share one disposable database and must not truncate concurrently.
    fileParallelism: !process.env.TEST_DATABASE_URL,
    globals: true,
    testTimeout: 15_000,
    setupFiles: ["./test/setup.ts"],
    reporters: process.env.CI
      ? ["default", ["junit", { outputFile: "test-results/vitest.junit.xml" }]]
      : ["default"],
    coverage: {
      provider: "v8",
      include: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.ts"],
      reporter: ["text", "json-summary", "lcov", "html"],
      reportsDirectory: "coverage",
      exclude: [
        "**/__tests__/**",
        "**/*.test.{ts,tsx}",
        "test/**",
        "tests/**",
        "e2e/**",
        "lib/db/migrations/**",
        "next-env.d.ts",
      ],
      thresholds: {
        "lib/ai/model.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "lib/crypto.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "lib/savings-projections.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        "lib/savings-targets.ts": {
          statements: 85,
          branches: 70,
          functions: 100,
          lines: 100,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
