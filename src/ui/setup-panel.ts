// Carte « Set-up » d'une fiche de cas :
// - set-up le plus court depuis le cube résolu (texte) ;
// - cube connecté : bouton pour préparer le cas depuis l'état actuel, avec guidage
//   mouvement par mouvement (comme pour un mélange) et vérification à la fin.
// Les mouvements sont affichés dans le repère joueur (jaune en haut, vert devant).

import { cubeFacelets, cubeStatus, onCubeEvent } from "../ble/cube-service";
import { CROSS_GROUPS, allSolved } from "../cube/facelets";
import { showsCaseState, type CaseDef } from "../cube/cases";
import { ScrambleTracker } from "../cube/scramble-tracker";
import { setupFromState, shortestSetup, switchFrame, toPlayerView } from "../cube/setup";
import { h } from "./dom";

export interface SetupPanel {
  el: HTMLElement;
  /** À appeler quand la liste des algos change (le set-up le plus court peut changer). */
  refresh(algs: string[]): void;
  destroy(): void;
}

/** Le cube (repère cube) montre-t-il le cas c, F2L faits ? */
function showsCase(cube: string, c: CaseDef): boolean {
  const state = toPlayerView(cube);
  if (!allSolved(state, CROSS_GROUPS.D.f2l)) return false;
  return showsCaseState(state, c);
}

export function setupPanel(c: CaseDef): SetupPanel {
  let setup = "";
  let tracker: ScrambleTracker | null = null;
  let computing = false;

  const setupEl = h("code", { class: "setup-alg" });
  const guide = h("div", { class: "scramble-box setup-guide" });
  const prepareBtn = h("button", { onclick: () => void prepare() }, "Préparer depuis l'état actuel");
  const actions = h("div", { class: "setup-actions" }, prepareBtn);

  const el = h(
    "section",
    { class: "card" },
    h("h2", {}, "Set-up"),
    // Façon de tenir le cube : une pastille de couleur en face de chaque consigne.
    h(
      "div",
      { class: "muted small setup-hold" },
      h("p", {}, h("i", { class: "hold-swatch yellow", "aria-hidden": "true" }), "jaune en haut,"),
      h("p", {}, h("i", { class: "hold-swatch green", "aria-hidden": "true" }), "vert devant :"),
    ),
    h("p", { class: "setup-line" }, h("span", { class: "muted small" }, "Cube résolu : "), setupEl),
    actions,
    guide,
  );

  async function prepare(): Promise<void> {
    const current = cubeFacelets.get();
    if (!current || computing) return;
    computing = true;
    tracker = null;
    guide.replaceChildren(h("p", { class: "muted" }, "Calcul du set-up depuis l'état du cube…"));
    try {
      const moves = await setupFromState(current, setup);
      tracker = new ScrambleTracker(moves);
    } catch (err) {
      console.error(err);
      guide.replaceChildren(h("p", { class: "status err" }, "Impossible de calculer le set-up (état du cube incohérent ?)."));
    } finally {
      computing = false;
    }
    render();
  }

  function render(): void {
    const connected = cubeStatus.get().state === "connected";
    actions.hidden = !connected;
    prepareBtn.textContent = tracker ? "Recalculer" : "Préparer depuis l'état actuel";
    if (!connected) {
      tracker = null;
      guide.replaceChildren();
      return;
    }
    if (!tracker) return;
    const view = tracker.view();
    if (view.done) {
      const ok = showsCase(cubeFacelets.get() ?? "", c);
      guide.replaceChildren(
        h(
          "p",
          { class: ok ? "status ok" : "status err" },
          ok ? "✓ Le cas est en place. À toi de jouer !" : "Le cube n'est pas dans l'état attendu : touche « Recalculer ».",
        ),
      );
      return;
    }
    guide.replaceChildren(
      h(
        "p",
        { class: "scramble" },
        ...view.steps.flatMap((step, i) => [i > 0 ? " " : "", h("span", { class: `step ${step.state}` }, switchFrame(step.text))]),
      ),
    );
    if (view.corrections.length) guide.append(h("p", { class: "corrections" }, `⚠ Corrige d'abord : ${switchFrame(view.corrections.join(" "))}`));
  }

  const unsubscribeEvents = onCubeEvent((event) => {
    if (event.type === "move" && tracker && !tracker.done) {
      tracker.apply(event.move);
      render();
    }
  });
  const unsubscribeStatus = cubeStatus.subscribe(() => render());

  return {
    el,
    refresh(algs) {
      setup = shortestSetup(c, algs);
      setupEl.textContent = setup;
    },
    destroy() {
      unsubscribeEvents();
      unsubscribeStatus();
    },
  };
}
