// Version affichée dans les réglages, pour savoir quelle version tourne sur le téléphone.

/** « v0.1.0 · 42ae58e · 10/11 17:05 » (commit et date du build, injectés par vite.config.ts). */
export function versionLabel(): string {
  const date = new Date(__BUILD_DATE__).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `v${__APP_VERSION__} · ${__APP_COMMIT__} · ${date}`;
}
