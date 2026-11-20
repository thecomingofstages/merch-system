import { defineConfig } from "vitest/config";

// Tests run the Express app in Node (no Workers runtime, no database).
export default defineConfig({
  // One file at a time: the integration tests share one test database, and some count orders across it.
  test: { include: ["tests/**/*.test.ts"], environment: "node", fileParallelism: false },
});
