import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import { transformWithOxc } from "vite";

export default defineConfig({
  plugins: [{
    name: "source-jsx",
    enforce: "pre",
    async transform(code, id) {
      if (id.includes("/src/") && /\.js$/.test(id)) {
        return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
      }
    },
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.js",
      "tests/integration/**/*.test.js",
    ],
    clearMocks: true,
    restoreMocks: true,
  },
});
