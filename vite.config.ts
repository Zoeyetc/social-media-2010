import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { index: "index.html", hero: "hero.html" } } },
  server: { proxy: { "/api/flickr-mail": { target: "http://127.0.0.1:8788", changeOrigin: false } } },
});
