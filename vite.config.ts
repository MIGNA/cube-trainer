import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

/** Identifiant court du commit construit (affiché dans les réglages pour savoir quelle version tourne). */
function commitId(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? "inconnu";
  }
}

export default defineConfig(({ command }) => ({
  // En production, l'appli est servie par GitHub Pages sous /cube-trainer/
  // (https://migna.github.io/cube-trainer/). En dev, à la racine.
  base: command === "build" ? "/cube-trainer/" : "/",
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commitId()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  // cubing.js lance un worker via new URL(…, import.meta.url) : le pré-bundling
  // de Vite en dev casserait ce chemin.
  optimizeDeps: {
    exclude: ["cubing"],
  },
  // En build, le worker de recherche de cubing.js (mélanges WCA, solveur du set-up)
  // importe l'assistant de préchargement de Vite. Par défaut celui-ci est placé dans
  // le fichier principal de l'appli (qui touche au DOM) et il utilise `document` pour
  // précharger : le worker plante (« Module worker instantiation failed »).
  // → assistant dans son propre fichier, et aucun préchargement depuis le worker.
  build: {
    modulePreload: {
      resolveDependencies: (_file, deps, { hostId }) => (hostId.includes("search-worker-entry") ? [] : deps),
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes("preload-helper") ? "preload-helper" : undefined),
      },
    },
  },
  plugins: [
    VitePWA({
      // Nouvelle version installée en arrière-plan, active au prochain
      // rafraîchissement ou à la réouverture de l'appli.
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
}));
