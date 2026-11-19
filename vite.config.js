import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Deno tests are run separately with `deno test`, see `npm run test:deno`
    exclude: [...configDefaults.exclude, "test/deno/**"],
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["html"],
      thresholds: {
        100: true,
      },
    },
  },
});
