// Onglet Entraînement : pour l'instant l'échauffement (triggers + PLL connues).
// Cube connecté : les répétitions sont comptées toutes seules (état du cube) et on
// passe à l'exercice suivant automatiquement. Sans cube : chrono à la main
// (« Démarrer » / « Terminé »).

import type { View } from "../../app/router";
import { cubeFacelets, cubeStatus, onCubeEvent, resyncCube } from "../../ble/cube-service";
import { mainAlg } from "../../cube/case-algs";
import { PLL_CASES } from "../../cube/cases";
import type { TrainingItem } from "../../storage/db";
import { applyAlg, type Face } from "../../cube/facelets";
import { getSetting, setSetting } from "../../storage/settings";
import { addTrainingSession } from "../../storage/training";
import { formatTime } from "../../timer/format";
import {
  DEFAULT_HOLDING,
  WarmupTracker,
  cubeMoves,
  drawWarmup,
  frontChoices,
  moveProgress,
  moveWeights,
  repetitionAlg,
  type Holding,
  type PllChoice,
  type WarmupExercise,
} from "../../training/warmup";
import { algView } from "../alg-view";
import { runPllRun } from "../pll-run";
import { onHelperSolved } from "../solve-sheet";
import { COLORS } from "../case-svg";
import { h } from "../dom";

/** Vitesse en quarts de tour par seconde. */
const tps = (moves: number, ms: number) => (ms > 0 ? (moves / (ms / 1000)).toFixed(1) : "—");

/** Couleur de chaque face dans le repère joueur (jaune en haut, vert devant). */
const COLOR_NAMES: Record<Face, string> = { U: "jaune", D: "blanc", F: "vert", B: "bleu", R: "orange", L: "rouge" };
const ALL_FACES: Face[] = ["U", "D", "F", "B", "R", "L"];

const dot = (f: Face) => h("i", { class: "color-dot", style: `background:${COLORS[f]}`, "aria-hidden": "true" });

/** « jaune en haut, vert devant » avec les pastilles de couleur. */
function holdingLabel(holding: Holding): HTMLElement {
  return h(
    "span",
    { class: "holding-label" },
    dot(holding.up),
    `${COLOR_NAMES[holding.up]} en haut, `,
    dot(holding.front),
    `${COLOR_NAMES[holding.front]} devant`,
  );
}

/** Choix de la tenue du cube : couleur du haut, puis de devant (parmi les 4 voisines). */
function holdingPicker(holding: Holding, onChange: (h: Holding) => void): HTMLElement {
  const row = (label: string, faces: Face[], selected: Face, pick: (f: Face) => void) =>
    h(
      "div",
      { class: "holding-row" },
      h("span", { class: "muted small" }, label),
      ...faces.map((f) =>
        h("button", {
          class: f === selected ? "color-pick selected" : "color-pick",
          style: `background:${COLORS[f]}`,
          title: COLOR_NAMES[f],
          "aria-label": COLOR_NAMES[f],
          "aria-pressed": String(f === selected),
          onclick: () => pick(f),
        }),
      ),
    );
  return h(
    "div",
    { class: "holding-picker" },
    row("En haut", ALL_FACES, holding.up, (up) => {
      // On garde la couleur de devant si elle reste possible.
      const fronts = frontChoices(up);
      onChange({ up, front: fronts.includes(holding.front) ? holding.front : fronts[0] });
    }),
    row("Devant", frontChoices(holding.up), holding.front, (front) => onChange({ up: holding.up, front })),
  );
}

async function pllChoices(): Promise<PllChoice[]> {
  const [statuses, algs] = await Promise.all([getSetting("caseStatus"), getSetting("caseAlgs")]);
  return PLL_CASES.flatMap((c) => {
    const status = statuses[c.id];
    return status === "known" || status === "learning" ? [{ id: c.id, status, alg: mainAlg(c, algs) }] : [];
  });
}

export const trainingView: View = {
  title: "Entraînement",
  mount(container) {
    let cleanupSession: (() => void) | null = null;
    let holding: Holding = DEFAULT_HOLDING;

    function home(): void {
      cleanupSession?.();
      cleanupSession = null;
      const info = h("p", { class: "muted small" }, "…");
      const start = h("button", { onclick: () => void begin() }, "Commencer l'échauffement");
      const holdingBox = h("div", { class: "holding" });
      const showHolding = () =>
        holdingBox.replaceChildren(
          h("h2", {}, "Tenue du cube"),
          h("p", { class: "muted small" }, "Pour le suivi avec le cube connecté : tiens-le toujours ainsi pendant les exercices."),
          h("p", {}, holdingLabel(holding)),
          holdingPicker(holding, (next) => {
            holding = next;
            void setSetting("warmupHolding", next);
            showHolding();
          }),
        );
      showHolding();
      void getSetting("warmupHolding").then((saved) => {
        holding = saved;
        showHolding();
      });
      // « Toutes mes PLL » : maîtrisées seules, ou avec celles à travailler (choix gardé).
      const KEY = "toutes-pll-a-travailler";
      let withLearning = false;
      try {
        withLearning = localStorage.getItem(KEY) === "1";
      } catch {
        /* stockage indisponible : choix par défaut */
      }
      const runInfo = h("p", { class: "muted small" }, "…");
      const knownBtn = h("button", { class: "secondary" }, "Maîtrisées");
      const allBtn = h("button", { class: "secondary" }, "+ à travailler");
      const runStart = h("button", { onclick: () => void beginRun() }, "Commencer");
      const showRunChoice = () => {
        knownBtn.classList.toggle("selected", !withLearning);
        allBtn.classList.toggle("selected", withLearning);
        void pllChoices().then((plls) => {
          const chosen = plls.filter((p) => withLearning || p.status === "known");
          runInfo.textContent = chosen.length
            ? `${chosen.length} PLL : ${chosen.map((p) => p.id).join(", ")}`
            : "Aucune PLL dans ce choix : marque-les dans l'onglet Algos.";
          runStart.disabled = chosen.length === 0;
        });
      };
      const choose = (value: boolean) => {
        withLearning = value;
        try {
          localStorage.setItem(KEY, value ? "1" : "0");
        } catch {
          /* ignoré */
        }
        showRunChoice();
      };
      knownBtn.onclick = () => choose(false);
      allBtn.onclick = () => choose(true);
      showRunChoice();
      async function beginRun(): Promise<void> {
        const chosen = (await pllChoices()).filter((p) => withLearning || p.status === "known");
        cleanupSession = runPllRun(container, chosen, home);
      }

      container.replaceChildren(
        h("h1", {}, "Entraînement"),
        h("section", { class: "card" }, holdingBox),
        h(
          "section",
          { class: "card" },
          h("h2", {}, "Échauffement"),
          h(
            "p",
            {},
            "3 triggers, puis 5 PLL tirées au hasard parmi tes PLL maîtrisées (complétées par celles à travailler). Chaque exercice est répété jusqu'à ce que le cube revienne à son point de départ.",
          ),
          h(
            "p",
            { class: "muted small" },
            "Cube connecté : les répétitions sont comptées toutes seules, à condition de tenir le cube comme indiqué plus haut (toujours pareil, toute la séance). Sans cube : touche « Démarrer » puis « Terminé » pour chaque exercice.",
          ),
          info,
          start,
        ),
        h(
          "section",
          { class: "card" },
          h("h2", {}, "Toutes mes PLL"),
          h(
            "p",
            {},
            "Enchaîne toutes tes PLL, dans l'ordre que tu veux, autant de fois que tu veux. La liste de celles pas encore faites reste à l'écran. À la fin, les erreurs par PLL.",
          ),
          h(
            "p",
            { class: "muted small" },
            "Cube connecté : chaque PLL est reconnue toute seule, quelle que soit ta façon de tenir le cube ; après une erreur, reviens à l'état d'avant la PLL et recommence. Sans cube : tu coches toi-même.",
          ),
          h("div", { class: "row segmented" }, knownBtn, allBtn),
          runInfo,
          runStart,
        ),
      );
      void pllChoices().then((plls) => {
        const known = plls.filter((p) => p.status === "known").length;
        const learning = plls.length - known;
        info.textContent =
          plls.length === 0
            ? "Aucune PLL marquée maîtrisée ou à travailler (onglet Algos) : l'échauffement se fera avec les triggers seuls."
            : `PLL disponibles : ${known} maîtrisée${known > 1 ? "s" : ""}, ${learning} à travailler.`;
      });
    }

    async function begin(): Promise<void> {
      const exercises = drawWarmup(await pllChoices());
      cleanupSession = runSession(container, exercises, holding, home);
    }

    home();
    return () => cleanupSession?.();
  },
};

/** Déroule une séance ; renvoie la fonction de nettoyage. */
function runSession(container: HTMLElement, exercises: WarmupExercise[], holding: Holding, onQuit: () => void): () => void {
  const results: TrainingItem[] = [];
  let index = 0;
  let tracker: WarmupTracker | null = null;
  let manualStart: number | null = null;
  let ticker = 0;
  let nextTimer = 0;
  /** Suivi perdu : on redemande son état au cube dès que le joueur s'arrête (mouvement perdu en route…). */
  let resyncTimer = 0;
  let saved = false;
  /** Mouvements reçus après la fin de l'exercice (en trop), repère cube. */
  let afterEnd: string[] = [];

  const isConnected = () => cubeStatus.get().state === "connected" && cubeFacelets.get() !== null;

  const progress = h("p", { class: "muted small" });
  const title = h("h2", {});
  const formula = h("div", { class: "warmup-alg" });
  const reps = h("p", { class: "warmup-reps" });
  const fix = h("p", { class: "corrections" });
  const holdingHint = h("p", { class: "muted small" }, "Tiens le cube : ", holdingLabel(holding));
  let moveEls: HTMLElement[] = [];
  let weights: number[] = [];
  const clock = h("p", { class: "big-time warmup-clock" });
  const note = h("p", { class: "muted small" });
  const mainBtn = h("button", {});
  const restartBtn = h("button", { class: "secondary", onclick: () => startExercise(null) }, "Recommencer l'exercice");
  const skipBtn = h("button", { class: "secondary", onclick: () => finish(true) }, "Passer");
  const quitBtn = h("button", { class: "link", onclick: () => endSession() }, "Arrêter la séance");

  /**
   * Démarre l'exercice en cours. `from` : fin de l'exercice précédent (état d'arrivée et
   * mouvements faits en trop depuis) ; le nouvel exercice part de cet état, et les
   * mouvements en trop sont à défaire d'abord.
   */
  function startExercise(from: { state: string; moves: string[] } | null): void {
    const ex = exercises[index];
    clearInterval(ticker);
    afterEnd = [];
    const current = cubeFacelets.get();
    const carried = from && current && from.moves.length && applyAlg(from.state, from.moves.join(" ")) === current ? from : null;
    tracker = isConnected() ? new WarmupTracker(ex, carried ? carried.state : current!, holding, carried?.moves ?? []) : null;
    if (import.meta.env.DEV && tracker) console.log(`[échauffement] ${ex.label} : attendu (repère cube) ${tracker.expected.slice(0, tracker.perRep).join(" ")}`);
    manualStart = null;
    progress.textContent = `Exercice ${index + 1} / ${exercises.length} · ${ex.kind === "trigger" ? "trigger" : "PLL"}`;
    title.textContent = ex.label;
    const view = algView(ex.alg, { interactive: true });
    // Retour à la tenue de départ (y'…) ou AUF : à part, en gris.
    const extra = ex.extra ? h("span", { class: "warmup-extra", title: "Pour revenir à la tenue de départ" }, " ", algView(ex.extra)) : null;
    formula.replaceChildren(view, extra ?? "", h("span", { class: "warmup-times" }, ` ×${ex.reps}`));
    moveEls = [...formula.querySelectorAll<HTMLElement>(".mv")];
    weights = moveWeights(repetitionAlg(ex));
    clock.textContent = formatTime(0);
    ticker = window.setInterval(tick, 100);
    render();
  }

  function elapsed(now = performance.now()): number {
    if (tracker) return tracker.firstMoveAt === null ? 0 : (tracker.finishedAt ?? now) - tracker.firstMoveAt;
    return manualStart === null ? 0 : now - manualStart;
  }

  function tick(): void {
    clock.textContent = formatTime(elapsed());
  }

  function render(): void {
    const ex = exercises[index];
    if (tracker) {
      reps.replaceChildren(
        ...Array.from({ length: ex.reps }, (_, k) => h("span", { class: k < tracker!.done ? "rep done" : "rep" })),
        h("span", { class: "muted small" }, ` ${tracker.done} / ${ex.reps}`),
      );
      note.textContent = tracker.extraMoves
        ? `Mouvements en trop : ${tracker.extraMoves}`
        : "Suivi en direct : les répétitions se comptent toutes seules.";
      // Formule allumée au fil des mouvements, et ce qu'il faut défaire en cas d'écart.
      moveProgress(weights, tracker.posInRep).forEach((st, i) => moveEls[i]?.setAttribute("data-progress", st));
      const fixes = tracker.lost ? tracker.corrections() : [];
      fix.hidden = !tracker.lost;
      const before = tracker.settling ? "Mouvements en trop à la fin de l'exercice précédent. " : "";
      fix.textContent =
        fixes === null ? `⚠ ${before}Défais tes derniers mouvements (ou « Recommencer l'exercice »).` : `⚠ ${before}Défais : ${fixes.join(" ")}`;
      mainBtn.hidden = true;
      restartBtn.hidden = false;
    } else {
      reps.replaceChildren(h("span", { class: "muted small" }, `${ex.reps} répétitions`));
      fix.hidden = true;
      moveEls.forEach((el) => el.removeAttribute("data-progress"));
      note.textContent = isConnected() ? "Cube connecté : il sera suivi à partir de l'exercice suivant." : "Sans cube : chrono à la main.";
      mainBtn.hidden = false;
      restartBtn.hidden = true;
      mainBtn.textContent = manualStart === null ? "Démarrer" : "Terminé";
      mainBtn.onclick = () => {
        if (manualStart === null) {
          manualStart = performance.now();
          render();
        } else finish(false);
      };
    }
  }

  function finish(skipped: boolean): void {
    const ex = exercises[index];
    clearInterval(ticker);
    results.push({
      label: ex.label,
      alg: repetitionAlg(ex),
      reps: ex.reps,
      timeMs: Math.round(elapsed()),
      connected: tracker !== null,
      expectedMoves: tracker?.expectedMoves ?? cubeMoves(ex).length,
      ...(tracker ? { moves: tracker.moves } : {}),
      ...(skipped ? { skipped: true } : {}),
    });
    const from = tracker?.finished && !skipped ? { state: tracker.startState, moves: afterEnd } : null;
    tracker = null;
    index++;
    if (index < exercises.length) startExercise(from);
    else endSession();
  }

  async function endSession(): Promise<void> {
    clearInterval(ticker);
    clearTimeout(nextTimer);
    clearTimeout(resyncTimer);
    tracker = null;
    const done = results.filter((r) => !r.skipped);
    if (done.length && !saved) {
      saved = true;
      await addTrainingSession({ date: Date.now(), kind: "warmup", items: results });
    }
    showSummary();
  }

  function showSummary(): void {
    const done = results.filter((r) => !r.skipped && r.timeMs > 0);
    const speed = (r: TrainingItem) => r.expectedMoves / (r.timeMs / 1000);
    const slowest = done.length > 1 ? done.reduce((a, b) => (speed(b) < speed(a) ? b : a)) : null;
    container.replaceChildren(
      h("h1", {}, "Échauffement terminé"),
      h(
        "section",
        { class: "card" },
        results.length === 0
          ? h("p", { class: "muted" }, "Aucun exercice fait.")
          : h(
              "table",
              { class: "warmup-table" },
              h("tr", {}, h("th", {}, "Exercice"), h("th", {}, "Temps"), h("th", {}, "Tours/s"), h("th", {}, "Erreurs")),
              ...results.map((r) =>
                h(
                  "tr",
                  { class: r === slowest ? "slowest" : "" },
                  h("td", {}, r.label, r === slowest ? h("small", { class: "muted" }, " · le plus lent") : null),
                  h("td", {}, r.skipped ? "passé" : formatTime(r.timeMs)),
                  h("td", {}, r.skipped ? "—" : tps(r.expectedMoves, r.timeMs)),
                  h("td", {}, r.moves === undefined ? "—" : String(Math.max(0, r.moves - r.expectedMoves))),
                ),
              ),
            ),
        h("p", { class: "muted small" }, "Tours/s = quarts de tour attendus par seconde. Erreurs = mouvements en trop (cube connecté)."),
      ),
      h("div", { class: "row" }, h("button", { onclick: () => onQuit() }, "Retour")),
    );
  }

  const unsubscribeMoves = onCubeEvent((event) => {
    if (!tracker || (event.type !== "move" && event.type !== "facelets")) return;
    if (tracker.finished) {
      if (event.type === "move") afterEnd.push(event.move); // en trop : à défaire au début de l'exercice suivant
      return;
    }
    if (event.type === "facelets") {
      // État réel renvoyé par le cube : le suivi se recale dessus.
      tracker.observe(cubeFacelets.get()!, performance.now());
      if (import.meta.env.DEV) console.log(`[échauffement] état du cube n°${event.serial ?? "?"} → pos ${tracker.pos}/${tracker.expectedMoves}${tracker.lost ? " · toujours perdu" : ""}`);
    } else {
      tracker.move(event.move, cubeFacelets.get()!, performance.now());
      // Dev : trace de chaque mouvement reçu, pour comprendre un suivi qui se perd.
      if (import.meta.env.DEV) {
        console.log(
          `[échauffement] ${event.move.padEnd(2)} n°${event.serial ?? "?"} → pos ${tracker.pos}/${tracker.expectedMoves}${tracker.lost ? ` · perdu, défais : ${tracker.corrections()?.join(" ") ?? "?"}` : ""}`,
        );
      }
      clearTimeout(resyncTimer);
      if (tracker.lost) resyncTimer = window.setTimeout(() => void resyncCube(), 1000);
    }
    render();
    if (tracker.finished) {
      clearInterval(ticker);
      tick();
      nextTimer = window.setTimeout(() => finish(false), 700);
    }
  });
  // Cube résolu avec le bouton « Résoudre » : l'exercice en cours repart de là.
  const offSolved = onHelperSolved(() => {
    if (tracker && !tracker.finished) startExercise(null);
  });
  const unsubscribeStatus = cubeStatus.subscribe(() => {
    if (index < exercises.length && container.contains(title)) render();
  });

  container.replaceChildren(
    h(
      "section",
      { class: "card warmup" },
      progress,
      holdingHint,
      title,
      formula,
      reps,
      fix,
      clock,
      note,
      h("div", { class: "row" }, mainBtn, restartBtn, skipBtn),
      quitBtn,
    ),
  );
  if (exercises.length) startExercise(null);
  else void endSession();

  return () => {
    clearInterval(ticker);
    clearTimeout(nextTimer);
    clearTimeout(resyncTimer);
    unsubscribeMoves();
    unsubscribeStatus();
    offSolved();
  };
}
