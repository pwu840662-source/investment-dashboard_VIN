import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/**
 * 開發時代理 Yahoo Finance、Frankfurter、CoinGecko，避免瀏覽器 CORS／連線被擋。
 * 正式環境請改用自有後端或支援 CORS 的資料來源。
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      includeAssets: ["icon.svg"],
      manifest: {
        name: "多市場投資看板",
        short_name: "投資看板",
        description: "台股、匯率、黃金、比特幣、原油的即時看板與走勢分析。",
        theme_color: "#0c0f14",
        background_color: "#0c0f14",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/yahoo/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "yahoo",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 30 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/frankfurter/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "frankfurter",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/coingecko/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "coingecko",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/yahoo": {
        target: "https://query1.finance.yahoo.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/yahoo/, ""),
      },
      "/frankfurter": {
        target: "https://api.frankfurter.dev",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/frankfurter/, ""),
      },
      "/coingecko": {
        target: "https://api.coingecko.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/coingecko/, ""),
      },
    },
  },
});
