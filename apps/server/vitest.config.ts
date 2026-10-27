import { defineConfig } from "vitest/config";

// Tests run the Express app in Node (no Workers runtime, no database).
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
