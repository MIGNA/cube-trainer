// Reconstruction lisible d'un solve analysé : mouvements regroupés par étape,
// fluidité, et passage dans le repère « croix en bas » pour l'affichage/replay.

import type { SolveMove } from "../storage/db";
import { STEP_LABELS, type SolveAnalysis, type StepId } from "./cfop";
import { FACES, ROTATION_TO_DOWN, SOLVED, applyAlg, formatTurn, parseMove, type Face, type Turn } from "./facelets";

/** Au-delà de cet écart entre deux mouvements, on considère que le cubeur s'est arrêté. */
export const PAUSE_MS = 500;

/**
 * Regroupe les quarts de tour consécutifs sur la même face (R R → R2, R R R → R')
 * et supprime ceux qui s'annulent (R R' → rien). Le cube n'envoie que des quarts de tour.
 */
export function mergeTurns(moves: readonly string[]): string[] {
  const out: Turn[] = [];
  for (const m of moves) {
    const t = parseMove(m);
    const last = out[out.length - 1];
    if (last && last.face === t.face) {
      const amount = (last.amount + t.amount) % 4;
      if (amount === 0) out.pop();
      else last.amount = amount as Turn["amount"];
    } else out.push({ ...t });
  }
  return out.map(formatTurn);
}

/**
 * Renomme les faces pour le repère où la croix est en bas : on fait la rotation
 * ROTATION_TO_DOWN[crossFace] et on regarde quelle face se retrouve où.
 * Ex. croix sur U (x2) : U↔D et F↔B.
 */
export function faceMapForCross(crossFace: Face): Record<Face, Face> {
  const rotated = applyAlg(SOLVED, ROTATION_TO_DOWN[crossFace]);
  const map = {} as Record<Face, Face>;
  FACES.forEach((position, i) => {
    // Le centre visible à la position i appartient à la face d'origine `rotated[i*9+4]`.
    map[rotated[i * 9 + 4] as Face] = position;
  });
  return map;
}

export function relabelMoves(moves: readonly string[], map: Record<Face, Face>): string[] {
  return moves.map((m) => {
    const t = parseMove(m);
    return formatTurn({ face: map[t.face], amount: t.amount });
  });
}

export interface StepReconstruction {
  id: StepId;
  label: string;
  /** Mouvements regroupés, dans le repère croix en bas. */
  moves: string[];
}

/** Mouvements de chaque étape (repère croix en bas), dans l'ordre du solve. */
export function reconstructSteps(analysis: SolveAnalysis, moves: readonly SolveMove[]): StepReconstruction[] {
  const map = faceMapForCross(analysis.crossFace);
  const all = relabelMoves(
    moves.map((x) => x.m),
    map,
  );
  let start = 0;
  return analysis.steps.map((step) => {
    const slice = all.slice(start, start + step.moves);
    start += step.moves;
    return { id: step.id, label: STEP_LABELS[step.id], moves: mergeTurns(slice) };
  });
}

/** Le mélange vu dans le repère croix en bas : mélange puis rotation du cube. */
export function setupForCross(scramble: string, crossFace: Face): string {
  return [scramble, ROTATION_TO_DOWN[crossFace]].filter(Boolean).join(" ");
}

/**
 * Fluidité = part du temps passée à tourner : 1 − (temps de pause / temps total),
 * où une pause est tout écart de plus de PAUSE_MS entre deux mouvements.
 */
export function fluency(moves: readonly SolveMove[]): number | null {
  if (moves.length < 2) return null;
  const total = moves[moves.length - 1].t - moves[0].t;
  if (total <= 0) return null;
  let paused = 0;
  for (let i = 1; i < moves.length; i++) {
    const gap = moves[i].t - moves[i - 1].t;
    if (gap > PAUSE_MS) paused += gap;
  }
  return 1 - paused / total;
}

/** Les quatre grands blocs de la barre de synthèse. */
export type PhaseId = "cross" | "f2l" | "oll" | "pll";

export const PHASE_OF: Record<StepId, PhaseId> = {
  cross: "cross",
  f2l1: "f2l",
  f2l2: "f2l",
  f2l3: "f2l",
  f2l4: "f2l",
  oll: "oll",
  pll: "pll",
};

export const PHASE_LABELS: Record<PhaseId, string> = { cross: "Croix", f2l: "F2L", oll: "OLL", pll: "PLL" };

export interface PhaseSummary {
  id: PhaseId;
  durationMs: number;
  /** Début du bloc, en ms depuis le premier mouvement. */
  startMs: number;
}

export function phases(analysis: SolveAnalysis): PhaseSummary[] {
  const out: PhaseSummary[] = [];
  let t = 0;
  for (const step of analysis.steps) {
    const id = PHASE_OF[step.id];
    const last = out[out.length - 1];
    if (last?.id === id) last.durationMs += step.durationMs;
    else out.push({ id, durationMs: step.durationMs, startMs: t });
    t += step.durationMs;
  }
  return out;
}
