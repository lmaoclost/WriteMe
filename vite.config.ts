/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // browser shim for deps that require the node path builtin
    alias: { path: "path-browserify" },
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
  },
});
