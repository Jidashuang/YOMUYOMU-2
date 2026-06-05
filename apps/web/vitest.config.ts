import { defineConfig } from "vitest/config";

// Pure-logic unit tests only (no browser/jsdom needed). The reader/library logic under
// test imports types from @yomuyomu/shared-types via `import type`, which esbuild erases,
// so these run without resolving the workspace package or rendering React.
export default defineConfig({
  test: {
    environment: "node",
    // The forks pool hangs under Node 25; threads runs these pure-logic tests reliably.
    pool: "threads",
    include: ["lib/**/*.test.ts"],
  },
});
