/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // browser shim for deps that require the node path builtin
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      path: "path-browserify",
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // browser shim for deps that require the node path builtin
      alias: { path: "path-browserify" },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**", "**/.superpowers/**"],
  },
});
