/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Scriptorium",
        short_name: "Scriptorium",
        description: "Local-first worldbuilding and writing studio.",
        start_url: "/",
        display: "standalone",
        background_color: "#1a1a2e",
        theme_color: "#c9a227",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        // fonts ship as hashed assets next to the code; cache them for a
        // fully offline cold start (no runtime API to route around)
        globPatterns: ["**/*.{js,css,html,svg,woff,woff2}"],
      },
    }),
  ],
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
