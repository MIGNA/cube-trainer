// Bouton « Enregistrer avec le cube » de la carte « Ajouter mon algo » (fiche d'un cas) :
// le joueur fait sa formule sur le cube connecté, elle est notée puis placée dans le champ
// de saisie (voir cube/alg-recorder.ts). Tenue = celle réglée dans l'onglet Entraînement.

import { cubeFacelets, cubeStatus, onCubeEvent } from "../ble/cube-service";
import { AlgRecorder } from "../cube/alg-recorder";
import type { CaseDef } from "../cube/cases";
import { getSetting } from "../storage/settings";
import { h } from "./dom";

export interface RecordPanel {
  el: HTMLElement;
  /** Ferme l'enregistrement (formule ajoutée). */
  reset(): void;
  destroy(): void;
}

export function recordPanel(c: CaseDef, onRecorded: (alg: string) => void): RecordPanel {
  let recorder: AlgRecorder | null = null;
  let starting = false;

  const startBtn = h("button", { class: "secondary", onclick: () => void start() }, "Enregistrer avec le cube");
  const cancelBtn = h("button", { class: "secondary", onclick: () => reset() }, "Annuler");
  const restartBtn = h("button", { class: "secondary", onclick: () => restart() }, "Recommencer");
  const info = h("p", { class: "status" });
  const moves = h("p", { class: "setup-line" });
  const el = h("div", { class: "record-panel" }, h("div", { class: "setup-actions" }, startBtn, restartBtn, cancelBtn), info, moves);

  async function start(): Promise<void> {
    const current = cubeFacelets.get();
    if (!current || starting) return;
    starting = true;
    try {
      recorder = new AlgRecorder(c, await getSetting("warmupHolding"));
      recorder.update(cubeFacelets.get() ?? current);
    } finally {
      starting = false;
    }
    render();
  }

  function restart(): void {
    const current = cubeFacelets.get();
    if (recorder && current) recorder.restart(current);
    render();
  }

  function reset(): void {
    recorder = null;
    render();
  }

  function render(): void {
    const connected = cubeStatus.get().state === "connected";
    if (!connected) recorder = null;
    startBtn.hidden = !connected || recorder !== null;
    restartBtn.hidden = !recorder || recorder.phase !== "recording" || recorder.count === 0;
    cancelBtn.hidden = !recorder;
    info.classList.remove("ok");
    moves.replaceChildren();
    if (!recorder) {
      info.textContent = connected ? "" : "Connecte le cube pour enregistrer ta formule en la faisant.";
      return;
    }
    if (recorder.phase === "waiting") {
      info.textContent = "Mets le cube sur ce cas, dernière couche en haut (le Set-up plus haut peut le préparer).";
      return;
    }
    if (recorder.phase === "recording") {
      info.textContent =
        recorder.count === 0
          ? "C'est parti : fais ta formule. Revenir à l'état de départ remet à zéro."
          : "Enregistrement… Ça s'arrête tout seul quand le cas est résolu.";
      if (recorder.count > 0) moves.append(h("code", { class: "setup-alg" }, recorder.alg));
      return;
    }
    // Fini : la formule part dans le champ ; on referme le panneau.
    const alg = recorder.alg;
    recorder = null;
    render();
    info.classList.add("ok");
    info.textContent = "✓ Cas résolu.";
    onRecorded(alg);
  }

  const unsubscribeEvents = onCubeEvent((event) => {
    if (!recorder || (event.type !== "move" && event.type !== "facelets")) return;
    const state = cubeFacelets.get();
    if (!state) return;
    recorder.update(state, event.type === "move" ? event.move : undefined);
    render();
  });
  const unsubscribeStatus = cubeStatus.subscribe(() => render());

  return {
    el,
    reset,
    destroy() {
      unsubscribeEvents();
      unsubscribeStatus();
    },
  };
}
