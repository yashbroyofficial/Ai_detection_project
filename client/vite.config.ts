import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const root = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, "");
  const cert = env.TLS_CERT_FILE;
  const key = env.TLS_KEY_FILE;
  if (Boolean(cert) !== Boolean(key)) {
    throw new Error("Set both TLS_CERT_FILE and TLS_KEY_FILE.");
  }
  const backend = `http://127.0.0.1:${env.PORT || "3001"}`;
  return {
    envDir: root,
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      https: cert && key ? {
        cert: readFileSync(resolve(root, cert)),
        key: readFileSync(resolve(root, key)),
      } : undefined,
      proxy: {
        "/api": { target: backend, changeOrigin: true },
        "/socket.io": { target: backend, changeOrigin: true, ws: true },
      },
    },
  };
});
