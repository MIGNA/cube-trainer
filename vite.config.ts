import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Tout mettre en cache pour un fonctionnement 100 % hors ligne (icônes comprises).
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
      // Génère les icônes PNG (192, 512, maskable, apple) à partir du SVG
      // et les ajoute au manifeste.
      pwaAssets: {
        image: "public/icon.svg",
      },
      manifest: {
        name: "Cube Trainer",
        short_name: "Cube",
        description: "Chrono et entraînement quotidien au Rubik's Cube, avec cube connecté.",
        lang: "fr",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#111418",
        background_color: "#111418",
      },
    }),
  ],
});
