import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds into ../docs so GitHub Pages can serve it straight from the repo.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "../docs", emptyOutDir: true },
});
