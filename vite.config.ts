import { defineConfig } from "vitest/config";

// The game is bundled by `friendsdk dev` / `friendsdk build`; Vite only runs the Vitest suites.
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
});
