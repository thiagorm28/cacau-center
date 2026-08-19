import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { type ManifestOptions, VitePWA } from "vite-plugin-pwa";

/** Manifest do PWA instalável, com as cores do `DESIGN.md`. */
const pwaManifest: Partial<ManifestOptions> = {
  name: "Cacau Center — Conferência de Notas",
  short_name: "Conferência",
  description: "Conferência de notas fiscais por bipagem de caixas, com operação offline.",
  lang: "pt-BR",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f5ead8",
  theme_color: "#3a2318",
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

/**
 * Porta 5174 e `VITE_API_URL` são fixados pelo `CLAUDE.md` da raiz — o
 * `playwright.config.ts` da suíte E2E depende exatamente desses valores.
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // O service worker não participa da suíte de componentes: gerá-lo em `test`
    // só adicionaria I/O de build a cada execução do Vitest.
    ...(mode === "test"
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            manifest: pwaManifest,
            includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
            workbox: {
              // App shell + assets estáticos ficam disponíveis offline (ADR-003);
              // as chamadas de API continuam dependentes de rede, exceto a fila
              // de bipagens, que é resolvida em IndexedDB por `useOfflineQueue`.
              globPatterns: ["**/*.{js,css,html,svg,png,woff2,wasm}"],
              navigateFallback: "index.html",
            },
            devOptions: { enabled: true, type: "module" },
          }),
        ]),
  ],
  resolve: {
    alias: {
      // Consome o workspace `shared` a partir do fonte, para que o app e a suíte
      // nunca dependam de um `npm run build` anterior daquele pacote.
      shared: resolvePath("../shared/src/index.ts"),
    },
  },
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    css: false,
  },
}));
