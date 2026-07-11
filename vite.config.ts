import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/onevault/" : "/",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["onevault.svg", "onevault-192.png", "onevault-512.png"],
      manifest: {
        name: "OneVault",
        short_name: "OneVault",
        description: "暗号化オフライン対応のOneDrive Markdown Vault",
        theme_color: "#171717",
        background_color: "#171717",
        display: "standalone",
        start_url: ".",
        scope: ".",
        orientation: "any",
        icons: [
          { src: "onevault-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "onevault-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "onevault-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "onevault.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ],
        shortcuts: [
          { name: "新規ノート", short_name: "新規", url: "?action=new" },
          { name: "日次ノート", short_name: "日次", url: "?action=daily" }
        ]
      },
      workbox: {
        navigateFallback: "index.html",
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: []
      }
    })
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: true
  }
}));
