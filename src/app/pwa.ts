// Service worker (mode « prompt ») : une nouvelle version téléchargée attend que
// l'utilisateur la demande (bouton dans les réglages) au lieu de s'activer en douce.
// On vérifie les mises à jour au démarrage et à chaque retour au premier plan.

import { registerSW } from "virtual:pwa-register";
import { signal } from "./signal";

/** Une nouvelle version est prête : il suffit de recharger. */
export const updateAvailable = signal(false);

let update: ((reload?: boolean) => Promise<void>) | null = null;

export function startPwa(): void {
  if (!("serviceWorker" in navigator)) return;
  update = registerSW({
    onNeedRefresh: () => updateAvailable.set(true),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
    },
  });
}

/** Active la nouvelle version et recharge la page. */
export function applyUpdate(): void {
  void update?.(true);
}

/** Version affichée : « v0.1.0 · 42ae58e · 10/11 17:05 ». */
export function versionLabel(): string {
  const date = new Date(__BUILD_DATE__).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return `v${__APP_VERSION__} · ${__APP_COMMIT__} · ${date}`;
}
