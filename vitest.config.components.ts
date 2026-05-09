import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "happy-dom",
    include: ["tests/components/**/*.test.ts", "tests/composables/**/*.test.ts"],
    globals: false,
    setupFiles: ["./tests/setup-dom.ts"],
  },
});
