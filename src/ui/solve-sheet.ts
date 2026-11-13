// Bouton « Résoudre » (haut à droite, à côté du bouton Bluetooth) : n'apparaît que quand le
// cube connecté n'est pas résolu et n'a pas bougé depuis 2 s. Ouvre un panneau qui
// calcule une solution depuis l'état réel du cube et guide mouvement par mouvement.
// Les exercices en cours peuvent repartir de l'état résolu (onHelperSolved).

import { cubeFacelets, cubeStatus, onCubeEvent, resyncCube } from "../ble/cube-service";
import { isSolved } from "../cube/facelets";
import { ScrambleTracker } from "../cube/scramble-tracker";
import { switchFrame } from "../cube/setup";
import { solutionFor } from "../cube/solve";
import { h } from "./dom";

const IDLE_MS = 2000;

const solvedListeners = new Set<() => void>();
/** Prévenu quand le cube vient d'être résolu avec le panneau (l'exercice en cours repart de là). */
export function onHelperSolved(listener: () => void): () => void {
  solvedListeners.add(listener);
  return () => solvedListeners.delete(listener);
}

/** Attend l'état renvoyé par le cube (après une demande), au plus `ms`. */
function nextFacelets(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(done, ms);
    const off = onCubeEvent((e) => e.type === "facelets" && done());
    function done(): void {
      clearTimeout(timer);
      off();
      resolve();
    }
  });
}

let sheet: { close: () => void } | null = null;

function close(fromHistory: boolean): void {
  if (!sheet) return;
  if (!fromHistory && (history.state as { sheet?: string } | null)?.sheet === "solve") {
    history.back(); // déclenche popstate → close(true)
    return;
  }
  sheet.close();
  sheet = null;
}

window.addEventListener("popstate", () => close(true));

export function openSolve(): void {
  if (sheet) return;
  const body = h("div", { class: "sheet-body" }, h("p", { class: "muted" }, "Lecture de l'état du cube…"));
  const closeBtn = h("button", { class: "secondary sheet-close", type: "button", "aria-label": "Fermer", onclick: () => close(false) }, "✕");
  const backdrop = h("div", { class: "sheet-backdrop", onclick: () => close(false) });
  const panel = h(
    "div",
    { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Résoudre le cube" },
    h("div", { class: "sheet-head" }, h("h1", {}, "Résoudre le cube"), closeBtn),
    body,
  );
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
  let tracker: ScrambleTracker | null = null;
  let closeTimer = 0;

  function render(): void {
    if (!tracker) return;
    const state = cubeFacelets.get();
    if (state && isSolved(state)) {
      body.replaceChildren(h("p", { class: "status ok" }, "✓ Cube résolu !"));
      tracker = null;
      for (const l of solvedListeners) l();
      closeTimer = window.setTimeout(() => close(false), 1200);
      return;
    }
    const view = tracker.view();
    body.replaceChildren(
      h("p", { class: "muted small" }, "Jaune en haut, vert devant. Les mouvements faits s'allument."),
      h(
        "p",
        { class: "scramble" },
        ...view.steps.flatMap((step, i) => [i > 0 ? " " : "", h("span", { class: `step ${step.state}` }, switchFrame(step.text))]),
      ),
      view.corrections.length ? h("p", { class: "corrections" }, `⚠ Corrige d'abord : ${switchFrame(view.corrections.join(" "))}`) : "",
      view.done ? h("p", { class: "status err" }, "Le cube n'est pas résolu : un mouvement a dû se perdre. Ferme et rouvre le panneau pour recalculer.") : "",
    );
  }

  const offMoves = onCubeEvent((event) => {
    if (event.type !== "move" || !tracker) return;
    tracker.apply(event.move);
    render();
  });

  async function compute(): Promise<void> {
    // On repart de l'état réel du cube (un mouvement a pu se perdre en route).
    const answer = nextFacelets(1000);
    await resyncCube();
    await answer;
    const current = cubeFacelets.get();
    if (!sheet) return;
    if (!current) {
      body.replaceChildren(h("p", { class: "status err" }, "Cube non connecté."));
      return;
    }
    body.replaceChildren(h("p", { class: "muted" }, "Calcul de la solution…"));
    try {
      tracker = new ScrambleTracker(await solutionFor(current));
      render();
    } catch (err) {
      console.error(err);
      body.replaceChildren(h("p", { class: "status err" }, "Impossible de calculer la solution (état du cube incohérent ?)."));
    }
  }

  document.body.append(backdrop, panel);
  document.body.classList.add("sheet-open");
  document.addEventListener("keydown", onKey);
  history.pushState({ ...(history.state as object | null), sheet: "solve" }, "");
  closeBtn.focus();

  sheet = {
    close() {
      clearTimeout(closeTimer);
      offMoves();
      backdrop.remove();
      panel.remove();
      document.body.classList.remove("sheet-open");
      document.removeEventListener("keydown", onKey);
    },
  };
  void compute();
}

/** Petite icône : flèche qui tourne (remettre en ordre). */
function solveIcon(): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML =
    '<path d="M20 12a8 8 0 1 1-2.34-5.66" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>' +
    '<path d="M20 3v5h-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>';
  return svg;
}

export function mountSolveButton(parent: HTMLElement): void {
  const button = h(
    "button",
    { class: "solve-button", type: "button", title: "Résoudre le cube", "aria-label": "Résoudre le cube", onclick: () => openSolve() },
    solveIcon(),
  );
  button.hidden = true;
  parent.append(button);

  let timer = 0;
  // Chaque changement d'état (mouvement, resynchro) relance l'attente de 2 s.
  const update = () => {
    clearTimeout(timer);
    button.hidden = true;
    const state = cubeFacelets.get();
    if (cubeStatus.get().state !== "connected" || !state || isSolved(state)) return;
    timer = window.setTimeout(() => (button.hidden = false), IDLE_MS);
  };
  cubeFacelets.subscribe(update);
  cubeStatus.subscribe(update);
}
