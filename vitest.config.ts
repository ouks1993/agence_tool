import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Minimal unit-test harness for pure `src/lib/**` modules.
 *
 * - `node` environment: the modules under test are framework-free (no DOM).
 * - `@` alias mirrors the tsconfig path map (`@/* -> ./src/*`).
 * - Only colocated `*.test.ts` files run; component/integration tests are out
 *   of scope for this first suite.
 *
 * No `globals: true` — every test imports `{ describe, it, expect }` from
 * "vitest" explicitly, so no ambient types are added to the tsconfig.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
