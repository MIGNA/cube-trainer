// Page détail d'un solve (#/solve/<id>) : synthèse façon acubemy (TPS, mouvements,
// fluidité, barre des étapes), tableau des étapes, reconstruction et replay 3D.

import type { View } from "../../app/router";
import { OLL_CASES, PLL_CASES } from "../../cube/cases";
import { STEP_LABELS, analyzeSolve, type CaseResult, type SolveAnalysis, type StepId, type StepSplit } from "../../cube/cfop";
import type { Face } from "../../cube/facelets";
import { faceMapForCross, reconstructSteps, relabelMoves, replayTimeline, setupForCross, stepAt } from "../../cube/reconstruction";
import type { Move } from "cubing/alg";
import type { TwistyPlayer } from "cubing/twisty";
import type { Penalty, Solve } from "../../storage/db";
import { deleteSolve, setPenalty, solves } from "../../storage/solves";
import { formatTime } from "../../timer/format";
import { effectiveTime } from "../../timer/stats";
import { h } from "../dom";
import { algoHref } from "./cases";
import { fmtTps, sec, slotDots, slotName, solveSummary, stepBlock, stepPaint } from "../solve-summary";

const stepTps = (moves: number, ms: number) => (ms > 0 ? moves / (ms / 1000) : null);

const CASE_NAMES = new Map([...OLL_CASES, ...PLL_CASES].map((c) => [c.id, c.name]));

function caseLabel(result: CaseResult, kind: "OLL" | "PLL"): string {
  if (result === "skip") return "skip";
  if (result === null) return "non reconnu";
  if (kind === "PLL") return `${result}-perm`;
  const name = CASE_NAMES.get(result);
  return name ? `${result.replace("OLL ", "")} · ${name}` : result;
}


function formatSolveTime(solve: Solve): string {
  const t = formatTime(effectiveTime(solve));
  return solve.penalty === "+2" ? `${t}+` : t;
}

// --- Tableau des étapes ---------------------------------------------------

function slotTag(slot: [Face, Face]): HTMLElement {
  return h("small", { class: "case slot" }, ...slotDots(slot), slotName(slot));
}

/** Nom du cas OLL/PLL ; lien vers sa fiche dans l'onglet Algos s'il est reconnu. */
function caseTag(result: CaseResult, label: string): HTMLElement {
  if (result === null || result === "skip") return h("small", { class: "case" }, label);
  return h("a", { class: "case case-link", href: algoHref(result) }, `${label} ›`);
}

function stepsTable(analysis: SolveAnalysis): HTMLElement {
  const caseOf = (id: StepId) => (id === "oll" ? caseLabel(analysis.oll, "OLL") : id === "pll" ? caseLabel(analysis.pll, "PLL") : null);
  // Mini-barre : longueur proportionnelle à la durée de l'étape (la plus longue = pleine largeur),
  // partie foncée = reconnaissance, partie claire = exécution.
  const longest = Math.max(1, ...analysis.steps.map((s) => s.durationMs));
  const miniBar = (s: StepSplit) =>
    h("div", { class: "mini-fill", style: `width:${(s.durationMs / longest) * 100}%` }, stepBlock(analysis, s));

  const rows = analysis.steps.map((s) => {
    const skipped = s.moves === 0;
    const sub = s.slot ? slotTag(s.slot) : caseOf(s.id) ? caseTag(s.id === "oll" ? analysis.oll : analysis.pll, caseOf(s.id)!) : null;
    return h(
      "tr",
      { class: skipped ? "skipped" : "" },
      // Repère coloré à gauche : la couleur de l'étape.
      h("th", { class: "step-name", style: `--paint:${stepPaint(analysis, s, "tb")}` }, STEP_LABELS[s.id], sub),
      h("td", { class: "bar-cell" }, skipped ? null : miniBar(s)),
      h("td", { class: "num" }, skipped ? "–" : sec(s.durationMs)),
      h("td", { class: "num" }, String(s.moves)),
      // TPS sur le temps total de l'étape, et en petit sur l'exécution seule (sans la reconnaissance).
      h(
        "td",
        { class: "num" },
        skipped ? "–" : fmtTps(stepTps(s.moves, s.durationMs)),
        !skipped && s.recognitionMs > 0 ? h("small", { class: "tps-exec" }, `exéc ${fmtTps(s.tps)}`) : null,
      ),
    );
  });
  return h(
    "section",
    { class: "card" },
    h("h2", {}, "Étapes"),
    h(
      "table",
      { class: "steps" },
      h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, ""), h("th", { class: "num" }, "Temps"), h("th", { class: "num" }, "Mvts"), h("th", { class: "num" }, "TPS"))),
      h("tbody", {}, ...rows),
      h(
        "tfoot",
        {},
        h(
          "tr",
          {},
          h("th", {}, "Total"),
          h("td", {}),
          h("td", { class: "num" }, sec(analysis.totalMs)),
          h("td", { class: "num" }, String(analysis.totalMoves)),
          h("td", { class: "num" }, fmtTps(analysis.tps)),
        ),
      ),
    ),
  );
}

// --- Reconstruction + replay ---------------------------------------------

/** Algo au format cubing.js : une ligne par étape, nom de l'étape en commentaire. */
function replayAlg(steps: { label: string; moves: string[] }[]): string {
  return steps
    .filter((s) => s.moves.length > 0)
    .map((s) => `${s.moves.join(" ")} // ${s.label}`)
    .join("\n");
}

type ReplayMode = "real" | "regular";
const SPEEDS = [0.5, 1, 2] as const;

function replayCard(analysis: SolveAnalysis, solve: Solve): { el: HTMLElement; dispose: () => void } {
  const moves = solve.moves!;
  const steps = reconstructSteps(analysis, moves);
  const setup = setupForCross(solve.scramble, analysis.crossFace);

  // Temps réel : quarts de tour un par un (tels que reçus du cube), aux horaires réels.
  const quarter = relabelMoves(
    moves.map((x) => x.m),
    faceMapForCross(analysis.crossFace),
  );
  let from = 0;
  const realSteps = analysis.steps.map((s) => {
    const slice = quarter.slice(from, from + s.moves);
    from += s.moves;
    return { label: STEP_LABELS[s.id], moves: slice };
  });
  const realAlg = replayAlg(realSteps);
  const spans = replayTimeline(moves.map((x) => x.t));

  let mode: ReplayMode = "real";
  let speed: (typeof SPEEDS)[number] = 1;

  const playerBox = h("div", { class: "replay-player" }, h("p", { class: "muted" }, "Chargement du cube 3D…"));
  const algBox = h("div", { class: "replay-alg" });
  const clock = h("span", { class: "replay-clock" }, "0.00");
  const stepEl = h("span", { class: "replay-step" });
  const overlay = h("div", { class: "replay-overlay" }, clock, stepEl);

  const modeBtns = {
    real: h("button", { class: "secondary", onclick: () => setMode("real") }, "Temps réel"),
    regular: h("button", { class: "secondary", onclick: () => setMode("regular") }, "Régulier"),
  };
  const speedBtns = SPEEDS.map((v) => h("button", { class: "secondary", onclick: () => setSpeed(v) }, `×${v}`));
  const controls = h(
    "div",
    { class: "replay-controls" },
    h("div", { class: "seg-group" }, modeBtns.real, modeBtns.regular),
    h("div", { class: "seg-group" }, ...speedBtns),
  );

  // Reconstruction texte, affichée tant que le replay 3D n'est pas chargé (ou s'il échoue).
  const text = h(
    "div",
    { class: "recon" },
    h("p", { class: "muted small" }, "Mélange (croix en bas) : ", setup),
    ...steps.map((s) =>
      h(
        "p",
        { class: s.moves.length ? "" : "muted" },
        h("span", { class: "recon-label", style: `--paint:${stepPaint(analysis, analysis.steps.find((x) => x.id === s.id)!, "tb")}` }, s.label),
        s.moves.length ? s.moves.join(" ") : "—",
      ),
    ),
  );

  let disposed = false;
  let player: TwistyPlayer | null = null;
  let MoveClass: typeof Move | null = null;

  function showTime(ms: number): void {
    // Le chrono et l'étape n'ont de sens qu'en temps réel (en régulier, la durée est artificielle).
    overlay.hidden = mode !== "real";
    const t = Math.max(0, ms);
    clock.textContent = sec(Math.min(t, analysis.totalMs));
    const current = stepAt(analysis, t);
    stepEl.textContent = current ? `${STEP_LABELS[current.id]}${current.recognizing ? " · reconnaissance" : ""}` : "résolu";
  }

  function apply(): void {
    modeBtns.real.classList.toggle("selected", mode === "real");
    modeBtns.regular.classList.toggle("selected", mode === "regular");
    speedBtns.forEach((b, i) => b.classList.toggle("selected", SPEEDS[i] === speed));
    if (!player || !MoveClass) return;
    const M = MoveClass;
    player.pause();
    if (mode === "real") {
      player.alg = realAlg;
      player.experimentalModel.animationTimelineLeavesRequest.set(
        // Horaires en ms : cubing.js les « marque » (MillisecondTimestamp), d'où le transtypage.
        spans.map((span, k) => ({ animLeaf: M.fromString(quarter[k]), start: span.start, end: span.end })) as never,
      );
      player.tempoScale = speed;
    } else {
      player.experimentalModel.animationTimelineLeavesRequest.set(null);
      player.alg = replayAlg(steps);
      player.tempoScale = 1.5 * speed;
    }
    player.jumpToStart();
    showTime(0);
  }

  function setMode(m: ReplayMode): void {
    mode = m;
    apply();
  }
  function setSpeed(v: (typeof SPEEDS)[number]): void {
    speed = v;
    if (player) player.tempoScale = mode === "real" ? v : 1.5 * v;
    apply();
  }

  void Promise.all([import("cubing/twisty"), import("cubing/alg")])
    .then(([{ TwistyPlayer, TwistyAlgViewer }, { Move }]) => {
      if (disposed) return;
      MoveClass = Move;
      const p = new TwistyPlayer({
        puzzle: "3x3x3",
        experimentalSetupAlg: setup,
        background: "none",
        controlPanel: "bottom-row",
        hintFacelets: "none",
      });
      player = p;
      p.experimentalModel.detailedTimelineInfo.addFreshListener((info) => showTime(info.timestamp));
      playerBox.replaceChildren(p, overlay);
      algBox.replaceChildren(new TwistyAlgViewer({ twistyPlayer: p }));
      text.hidden = true;
      apply();
    })
    .catch(() => {
      playerBox.replaceChildren(h("p", { class: "muted" }, "Replay 3D indisponible."));
      controls.hidden = true;
    });

  apply();
  return {
    el: h(
      "section",
      { class: "card" },
      h("h2", {}, "Replay"),
      controls,
      playerBox,
      h("p", { class: "muted small" }, "Touche un mouvement pour y aller."),
      algBox,
      text,
    ),
    dispose: () => {
      disposed = true;
      player?.pause();
      player?.remove();
    },
  };
}

// --- Vue ------------------------------------------------------------------

export const solveView: View = {
  title: "Solve",
  mount(container, params) {
    const id = Number(params[0]);
    const back = h("a", { href: "#/stats", class: "back" }, "‹ Historique");
    const header = h("section", { class: "card solve-header" });
    container.append(back, header);

    const solve = solves.get().find((s) => s.id === id);
    if (!solve) {
      header.append(h("p", { class: "muted" }, "Solve introuvable (supprimé ?)."));
      return;
    }

    let dispose: (() => void) | undefined;
    if (!solve.moves?.length) {
      container.append(
        h("section", { class: "card" }, h("p", { class: "muted" }, "Pas d'analyse : ce solve a été chronométré sans le cube connecté.")),
      );
    } else {
      const analysis = analyzeSolve(solve.scramble, solve.moves);
      if (!analysis) {
        container.append(
          h(
            "section",
            { class: "card" },
            h("p", { class: "muted" }, "Analyse impossible : les mouvements enregistrés ne ramènent pas le cube à l'état résolu (mouvements perdus pendant le solve ?)."),
          ),
        );
      } else {
        const replay = replayCard(analysis, solve);
        dispose = replay.dispose;
        container.append(h("section", { class: "card" }, solveSummary(analysis, solve.moves)), stepsTable(analysis), replay.el);
      }
    }

    function renderHeader(current: Solve): void {
      const btn = (label: string, penalty: Penalty) =>
        h(
          "button",
          { class: `secondary${current.penalty === penalty ? " selected" : ""}`, onclick: () => void setPenalty(id, penalty) },
          label,
        );
      header.replaceChildren(
        h("div", { class: "solve-title" }, h("span", { class: "big-time" }, formatSolveTime(current)), h("small", { class: "muted" }, new Date(current.date).toLocaleString("fr-FR"))),
        h("p", { class: "scramble small" }, current.scramble),
        h(
          "div",
          { class: "row" },
          btn("OK", "none"),
          btn("+2", "+2"),
          btn("DNF", "DNF"),
          h(
            "button",
            {
              class: "secondary danger",
              onclick: async () => {
                await deleteSolve(id);
                location.hash = "#/stats";
              },
            },
            "Supprimer",
          ),
        ),
      );
    }

    const unsubscribe = solves.subscribe((list) => {
      const current = list.find((s) => s.id === id);
      if (current) renderHeader(current);
    });

    return () => {
      unsubscribe();
      dispose?.();
    };
  },
};
