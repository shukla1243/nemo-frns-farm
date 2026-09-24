import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages under /<repo>/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  test: { include: ["tests/**/*.test.ts"] },
} as Parameters<typeof defineConfig>[0]);
