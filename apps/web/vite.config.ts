/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// envDir points at the repository root so the SPA and the API share one .env.
export default defineConfig({
  plugins: [react()],
  envDir: "../../",
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    css: false,
  },
});