import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // .worktrees/** holds linked git worktrees. Their test files would
    // otherwise be globbed by this config and have their "@/" imports resolved
    // against *this* checkout's src, so a worktree's tests silently run against
    // the wrong source tree — and inflate the count by double-running.
    exclude: [...configDefaults.exclude, "tests/e2e/**", ".claude/**", ".worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
