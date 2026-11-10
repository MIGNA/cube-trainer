// Page détail d'un solve (#/solve/<id>) : synthèse façon acubemy (TPS, mouvements,
// fluidité, barre des étapes), tableau des étapes, reconstruction et replay 3D.

import type { View } from "../../app/router";
import { OLL_CASES, PLL_CASES } from "../../cube/cases";
import { FACE_COLORS, STEP_LABELS, analyzeSolve, type CaseResult, type SolveAnalysis, type StepId } from "../../cube/cfop";
import { PHASE_LABELS, PHASE_OF, fluency, phases, reconstructSteps, setupForCross, type StepReconstruction } from "../../cube/reconstruction";
import type { Penalty, Solve } from "../../storage/db";
import { deleteSolve, setPenalty, solves } from "../../storage/solves";
import { formatTime } from "../../timer/format";
import { effectiveTime } from "../../timer/stats";
import { h } from "../dom";

const CASE_NAMES = new Map([...OLL_CASES, ...PLL_CASES].map((c) => [c.id, c.name]));

function caseLabel(result: CaseResult, kind: "OLL" | "PLL"): string {
  if (result === "skip") return "skip";
  if (result === null) return "non reconnu";
  if (kind === "PLL") return `${result}-perm`;
  const name = CASE_NAMES.get(result);
  return name ? `${result.replace("OLL ", "")} · ${name}` : result;
}

const sec = (ms: number) => (ms / 1000).toFixed(2);
const fmtTps = (tps: number | null) => (tps == null ? "–" : tps.toFixed(2));

function formatSolveTime(solve: Solve): string {
  const t = formatTime(effectiveTime(solve));
  return solve.penalty === "+2" ? `${t}+` : t;
}

// --- Synthèse -------------------------------------------------------------

function summaryCard(analysis: SolveAnalysis, solve: Solve): HTMLElement {
  const flu = fluency(solve.moves!);
  const headline = h(
    "p",
    { class: "summary-line" },
    `${fmtTps(analysis.tps)} TPS`,
    h("span", { class: "sep" }, "|"),
    `${analysis.totalMoves} mouvements`,
    h("span", { class: "sep" }, "|"),
    `${flu == null ? "–" : Math.round(flu * 100)} % fluidité`,
  );

  // Barre : un bloc par phase (croix, F2L, OLL, PLL), et dans chaque bloc un segment
  // par étape, découpé en reconnaissance (foncé) puis exécution (clair).
  const total = analysis.totalMs || 1;
  const bar = h(
    "div",
    { class: "phase-bar" },
    ...phases(analysis).map((phase) => {
      const steps = analysis.steps.filter((s) => PHASE_OF[s.id] === phase.id);
      const segments = h(
        "div",
        { class: "phase-track" },
        ...steps.flatMap((s, i) => {
          const tone = phase.id === "f2l" && i % 2 === 1 ? " alt" : "";
          return [
            s.recognitionMs > 0 ? h("span", { class: `seg reco${tone}`, style: `flex-grow:${s.recognitionMs}` }) : null,
            s.executionMs > 0 ? h("span", { class: `seg${tone}`, style: `flex-grow:${s.executionMs}` }) : null,
          ];
        }),
      );
      return h(
        "div",
        { class: `phase phase-${phase.id}`, style: `flex-grow:${Math.max(phase.durationMs, total * 0.06)}` },
        h("strong", {}, phase.durationMs > 0 ? sec(phase.durationMs) : "skip"),
        segments,
        h("small", {}, PHASE_LABELS[phase.id]),
      );
    }),
  );

  const legend = h(
    "p",
    { class: "muted small legend" },
    h("span", { class: "swatch reco" }),
    " reconnaissance ",
    h("span", { class: "swatch" }),
    " exécution · croix ",
    FACE_COLORS[analysis.crossFace],
  );

  return h("section", { class: "card" }, headline, bar, legend);
}

// --- Tableau des étapes ---------------------------------------------------

function stepsTable(analysis: SolveAnalysis): HTMLElement {
  const caseOf = (id: StepId) => (id === "oll" ? caseLabel(analysis.oll, "OLL") : id === "pll" ? caseLabel(analysis.pll, "PLL") : null);
  const rows = analysis.steps.map((s) =>
    h(
      "tr",
      { class: `step-${PHASE_OF[s.id]}` },
      h("th", {}, STEP_LABELS[s.id], caseOf(s.id) ? h("small", { class: "case" }, caseOf(s.id)) : null),
      h("td", {}, sec(s.durationMs)),
      h("td", { class: "muted" }, s.id === "cross" ? "–" : sec(s.recognitionMs)),
      h("td", { class: "muted" }, sec(s.executionMs)),
      h("td", {}, String(s.moves)),
      h("td", { class: "muted" }, fmtTps(s.tps)),
    ),
  );
  return h(
    "section",
    { class: "card" },
    h("h2", {}, "Étapes"),
    h(
      "div",
      { class: "table-wrap" },
      h(
        "table",
        { class: "steps" },
        h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, "Temps"), h("th", {}, "Reco"), h("th", {}, "Exéc"), h("th", {}, "Mvts"), h("th", {}, "TPS"))),
        h("tbody", {}, ...rows),
        h(
          "tfoot",
          {},
          h(
            "tr",
            {},
            h("th", {}, "Total"),
            h("td", {}, sec(analysis.totalMs)),
            h("td", { class: "muted" }, sec(analysis.steps.reduce((t, s) => t + s.recognitionMs, 0))),
            h("td", { class: "muted" }, sec(analysis.steps.reduce((t, s) => t + s.executionMs, 0))),
            h("td", {}, String(analysis.totalMoves)),
            h("td", { class: "muted" }, fmtTps(analysis.tps)),
          ),
        ),
      ),
    ),
  );
}

// --- Reconstruction + replay ---------------------------------------------

/** Algo au format cubing.js : une ligne par étape, nom de l'étape en commentaire. */
function replayAlg(steps: StepReconstruction[]): string {
  return steps
    .filter((s) => s.moves.length > 0)
    .map((s) => `${s.moves.join(" ")} // ${s.label}`)
    .join("\n");
}

function replayCard(analysis: SolveAnalysis, solve: Solve): { el: HTMLElement; dispose: () => void } {
  const steps = reconstructSteps(analysis, solve.moves!);
  const setup = setupForCross(solve.scramble, analysis.crossFace);
  const playerBox = h("div", { class: "replay-player" }, h("p", { class: "muted" }, "Chargement du cube 3D…"));
  const algBox = h("div", { class: "replay-alg" });

  // Reconstruction texte, toujours visible (le replay 3D se charge à côté).
  const text = h(
    "div",
    { class: "recon" },
    h("p", { class: "muted small" }, "Mélange (croix en bas) : ", setup),
    ...steps.map((s) =>
      h(
        "p",
        { class: s.moves.length ? "" : "muted" },
        h("span", { class: `recon-label step-${PHASE_OF[s.id]}` }, s.label),
        s.moves.length ? s.moves.join(" ") : "—",
      ),
    ),
  );

  let disposed = false;
  let player: HTMLElement | null = null;
  void import("cubing/twisty")
    .then(({ TwistyPlayer, TwistyAlgViewer }) => {
      if (disposed) return;
      const p = new TwistyPlayer({
        puzzle: "3x3x3",
        experimentalSetupAlg: setup,
        alg: replayAlg(steps),
        background: "none",
        controlPanel: "bottom-row",
        hintFacelets: "none",
        tempoScale: 1.5,
      });
      player = p;
      playerBox.replaceChildren(p);
      algBox.replaceChildren(new TwistyAlgViewer({ twistyPlayer: p }));
      text.hidden = true;
    })
    .catch(() => {
      playerBox.replaceChildren(h("p", { class: "muted" }, "Replay 3D indisponible."));
    });

  return {
    el: h("section", { class: "card" }, h("h2", {}, "Replay"), playerBox, h("p", { class: "muted small" }, "Touche un mouvement pour y aller."), algBox, text),
    dispose: () => {
      disposed = true;
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
        container.append(summaryCard(analysis, solve), stepsTable(analysis), replay.el);
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
