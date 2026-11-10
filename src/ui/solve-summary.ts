// Synthèse d'un solve analysé (ligne TPS / mouvements / fluidité + barre des étapes),
// partagée entre la page détail et le bas de l'écran du chrono.
// Les étapes prennent les couleurs du cube : croix = sa couleur, paire F2L = ses deux
// couleurs, OLL = couleur de la dernière face, PLL = violet.

import { FACE_COLORS, type SolveAnalysis, type StepSplit } from "../cube/cfop";
import { OPPOSITE, type Face } from "../cube/facelets";
import { PHASE_LABELS, PHASE_OF, fluency, phases } from "../cube/reconstruction";
import type { SolveMove } from "../storage/db";
import { h } from "./dom";

/** Couleurs réelles des autocollants. */
export const STICKER_HEX: Record<Face, string> = { U: "#f4f4f4", D: "#ffd500", F: "#00a651", B: "#1e64d6", R: "#d7263d", L: "#ff7a1a" };

/** Ordre d'affichage des faces d'une paire : avant/arrière puis droite/gauche (« vert-rouge »). */
const SIDE_ORDER: Face[] = ["F", "B", "R", "L", "U", "D"];
const bySide = (faces: Face[]) => [...faces].sort((a, b) => SIDE_ORDER.indexOf(a) - SIDE_ORDER.indexOf(b));

export const sec = (ms: number) => (ms / 1000).toFixed(2);
export const fmtTps = (tps: number | null) => (tps == null ? "–" : tps.toFixed(2));

/** Couleur de la PLL : aucune face du cube ne l'a, donc pas de confusion avec une paire. */
const PLL_COLOR = "#a173e0";

/**
 * Fond CSS d'une étape, toujours sous forme de dégradé (utilisable comme image de fond).
 * Paire F2L : ses deux couleurs, côte à côte ("lr", dans les barres) ou l'une sur l'autre ("tb", repère fin).
 */
export function stepPaint(analysis: SolveAnalysis, step: StepSplit, split: "lr" | "tb" = "lr"): string {
  const solid = (c: string) => `linear-gradient(${c}, ${c})`;
  switch (PHASE_OF[step.id]) {
    case "cross":
      return solid(STICKER_HEX[analysis.crossFace]);
    case "oll":
      return solid(STICKER_HEX[OPPOSITE[analysis.crossFace]]);
    case "pll":
      return solid(PLL_COLOR);
    case "f2l": {
      if (!step.slot) return solid("#7468e6");
      const [a, b] = bySide(step.slot).map((f) => STICKER_HEX[f]);
      return `linear-gradient(${split === "lr" ? "90deg, " : ""}${a} 50%, ${b} 50%)`;
    }
  }
}

/** Nom des couleurs d'une paire, ex. « vert-rouge ». */
export function slotName(slot: [Face, Face]): string {
  return bySide(slot)
    .map((f) => FACE_COLORS[f])
    .join("-");
}

export function slotDots(slot: [Face, Face]): HTMLElement[] {
  return bySide(slot).map((f) => h("span", { class: "dot", style: `background:${STICKER_HEX[f]}` }));
}

/**
 * Bloc d'une étape (largeur ∝ durée), à ses couleurs ; la reconnaissance est
 * hachurée sur le début du bloc.
 */
export function stepBlock(analysis: SolveAnalysis, step: StepSplit): HTMLElement | null {
  if (step.durationMs <= 0) return null;
  return h(
    "span",
    { class: "seg", style: `flex-grow:${step.durationMs};background-image:${stepPaint(analysis, step)}` },
    step.recognitionMs > 0 ? h("span", { class: "reco", style: `width:${(step.recognitionMs / step.durationMs) * 100}%` }) : null,
  );
}

/** Ligne de synthèse + barre des étapes + légende. */
export function solveSummary(analysis: SolveAnalysis, moves: readonly SolveMove[]): HTMLElement {
  const flu = fluency(moves);
  const headline = h(
    "p",
    { class: "summary-line" },
    `${fmtTps(analysis.tps)} TPS`,
    h("span", { class: "sep" }, "|"),
    `${analysis.totalMoves} mouvements`,
    h("span", { class: "sep" }, "|"),
    `${flu == null ? "–" : Math.round(flu * 100)} % fluidité`,
  );

  // Un bloc par phase (croix, F2L, OLL, PLL) ; dans chaque bloc, un segment par étape.
  const total = analysis.totalMs || 1;
  const bar = h(
    "div",
    { class: "phase-bar" },
    ...phases(analysis).map((phase) =>
      h(
        "div",
        { class: "phase", style: `flex-grow:${Math.max(phase.durationMs, total * 0.06)}` },
        h("strong", {}, phase.durationMs > 0 ? sec(phase.durationMs) : "skip"),
        h(
          "div",
          { class: "phase-track" },
          ...analysis.steps.filter((s) => PHASE_OF[s.id] === phase.id).map((s) => stepBlock(analysis, s)),
        ),
        h("small", {}, PHASE_LABELS[phase.id]),
      ),
    ),
  );

  const legend = h(
    "p",
    { class: "muted small legend" },
    h("span", { class: "swatch reco" }),
    " reconnaissance ",
    h("span", { class: "swatch" }),
    " exécution",
  );

  return h("div", { class: "solve-summary" }, headline, bar, legend);
}
