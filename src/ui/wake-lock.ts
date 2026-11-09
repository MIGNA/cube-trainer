// Garde l'écran allumé tant que la vue est affichée (chrono, entraînement).
// Le navigateur relâche le verrou quand l'onglet passe en arrière-plan : on le reprend au retour.

export function keepScreenOn(): () => void {
  let sentinel: WakeLockSentinel | null = null;
  let active = true;

  async function acquire(): Promise<void> {
    if (!active || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
    try {
      sentinel = await navigator.wakeLock.request("screen");
    } catch {
      // refusé (batterie faible, etc.) : pas bloquant
    }
  }

  function onVisibility(): void {
    if (document.visibilityState === "visible") void acquire();
  }

  document.addEventListener("visibilitychange", onVisibility);
  void acquire();

  return () => {
    active = false;
    document.removeEventListener("visibilitychange", onVisibility);
    void sentinel?.release();
    sentinel = null;
  };
}
