import { defineConfig, transformWithOxc } from "vite";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const local = (file) => fileURLToPath(new URL(file, import.meta.url));
export default defineConfig({
  root: local("./"), publicDir: `${root}/public`,
  optimizeDeps: { noDiscovery: true, include: ["react", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
  server: { host: "127.0.0.1", port: 3199, strictPort: true, fs: { allow: [root] } },
  resolve: { alias: [
    { find: "next/navigation", replacement: local("./navigation.jsx") },
    { find: "next/link", replacement: local("./link.jsx") },
    { find: "next/image", replacement: local("./image.jsx") },
    { find: /^@\/app\/actions\/.+$/, replacement: local("./actions.js") },
    { find: "@", replacement: `${root}/src` },
  ] },
  plugins: [{ name: "source-jsx", enforce: "pre", async transform(code, id) {
    if (id.includes("/src/") && /\.js$/.test(id)) return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
  } }],
});
