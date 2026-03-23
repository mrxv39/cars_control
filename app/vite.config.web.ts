import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Serve index-web.html instead of index.html in dev mode
function serveWebIndex(): Plugin {
  return {
    name: "serve-web-index",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/" || req.url === "/index.html") {
          req.url = "/index-web.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveWebIndex()],
  root: ".",
  server: {
    port: 3000,
  },
  build: {
    outDir: "dist-web",
    rollupOptions: {
      input: resolve(__dirname, "index-web.html"),
    },
  },
});
