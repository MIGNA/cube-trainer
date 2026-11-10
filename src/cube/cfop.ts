// Analyse CFOP d'un solve enregistré par le cube connecté.
//
// On rejoue les mouvements depuis l'état mélangé et on repère l'instant où
// chaque étape est terminée : croix, chacune des 4 paires F2L, OLL, PLL.
// La face de croix n'est pas imposée : c'est celle dont la croix est terminée en
// premier (puis, à égalité, celle dont les F2L sont finis en premier). Le critère
// « F2L finis en premier » seul se trompe en fin de solve : juste avant un dernier
// R', les deux premières couches vues depuis L sont aussi « finies ».
//
// Pour chaque étape :
// - reconnaissance = pause entre la fin de l'étape précédente et le 1er mouvement ;
// - exécution = du 1er au dernier mouvement de l'étape ;
// - TPS = mouvements / exécution.
// Les mouvements sont comptés tels que le cube les envoie (R2 = 2 quarts de tour).

import type { SolveMove } from "../storage/db";
import { recognizeOll, recognizePll } from "./cases";
import { CROSS_GROUPS, FACES, ROTATION_TO_DOWN, SOLVED, allSolved, applyAlg, applyMove, isSolved, type Face } from "./facelets";

export type StepId = "cross" | "f2l1" | "f2l2" | "f2l3" | "f2l4" | "oll" | "pll";

export const STEP_LABELS: Record<StepId, string> = {
  cross: "Croix",
  f2l1: "F2L 1",
  f2l2: "F2L 2",
  f2l3: "F2L 3",
  f2l4: "F2L 4",
  oll: "OLL",
  pll: "PLL",
};

/** Couleur des centres d'un cube GAN en orientation standard (blanc en haut, vert devant). */
export const FACE_COLORS: Record<Face, string> = {
  U: "blanc",
  D: "jaune",
  F: "vert",
  B: "bleu",
  R: "rouge",
  L: "orange",
};

export interface StepSplit {
  id: StepId;
  moves: number;
  /** Fin de l'étape, en ms depuis le premier mouvement. */
  endMs: number;
  durationMs: number;
  recognitionMs: number;
  executionMs: number;
  /** null si l'exécution est trop courte pour être mesurée (0 ou 1 mouvement). */
  tps: number | null;
  /** Paires F2L : les deux faces latérales de l'emplacement rempli (ex. ["F", "R"] = vert-rouge). */
  slot?: [Face, Face];
}

/** Cas reconnu : identifiant ("OLL 27", "T"…), "skip", ou null si non reconnu. */
export type CaseResult = string | "skip" | null;

export interface SolveAnalysis {
  crossFace: Face;
  steps: StepSplit[];
  totalMs: number;
  totalMoves: number;
  tps: number | null;
  oll: CaseResult;
  pll: CaseResult;
}

const tps = (moves: number, ms: number) => (ms > 0 ? moves / (ms / 1000) : null);

/**
 * Analyse un solve. Renvoie null s'il n'y a pas de mouvements ou si le cube
 * n'est pas résolu à la fin (solve interrompu, mouvements perdus…).
 * @param startFacelets état avant le premier mouvement (par défaut : résolu + mélange)
 */
export function analyzeSolve(scramble: string, moves: readonly SolveMove[], startFacelets?: string): SolveAnalysis | null {
  if (moves.length === 0) return null;

  // states[k] = état après k mouvements
  const states = [startFacelets ?? applyAlg(SOLVED, scramble)];
  for (const { m } of moves) states.push(applyMove(states[states.length - 1], m));
  const n = moves.length;
  if (!isSolved(states[n])) return null;

  // time(k) = instant où l'état k est atteint (0 au départ)
  const time = (k: number) => (k === 0 ? 0 : moves[k - 1].t);

  // Face de croix : croix terminée le plus tôt (puis F2L le plus tôt).
  const firstIndex = (pred: (f: string) => boolean, from = 0) => {
    for (let k = from; k <= n; k++) if (pred(states[k])) return k;
    return n;
  };
  let best: { face: Face; crossK: number; f2lK: number } | null = null;
  for (const face of FACES) {
    const g = CROSS_GROUPS[face];
    const f2lK = firstIndex((f) => allSolved(f, g.f2l));
    const crossK = firstIndex((f) => allSolved(f, g.cross));
    if (!best || crossK < best.crossK || (crossK === best.crossK && f2lK < best.f2lK)) best = { face, crossK, f2lK };
  }
  const { face, crossK, f2lK } = best!;
  const g = CROSS_GROUPS[face];

  // Paires F2L : nombre d'emplacements résolus (croix intacte) atteint pour la 1re fois.
  // On note aussi quel emplacement vient d'être rempli (le premier non encore attribué).
  const pairK = [0, 0, 0, 0];
  const pairSlot: (number | undefined)[] = [];
  const assigned = new Set<number>();
  const assignNew = (solvedNow: number[]) => {
    const fresh = solvedNow.find((j) => !assigned.has(j)) ?? [0, 1, 2, 3].find((j) => !assigned.has(j));
    if (fresh !== undefined) assigned.add(fresh);
    return fresh;
  };
  let reached = 0;
  for (let k = crossK; k <= f2lK && reached < 4; k++) {
    if (!allSolved(states[k], g.cross)) continue;
    const solvedNow = g.slots.flatMap((slot, j) => (allSolved(states[k], slot) ? [j] : []));
    while (reached < solvedNow.length) {
      pairSlot[reached] = assignNew(solvedNow);
      pairK[reached++] = k;
    }
  }
  for (let j = reached; j < 4; j++) {
    pairSlot[j] = assignNew([]);
    pairK[j] = f2lK;
  }
  const slotFaces = (j: number | undefined): [Face, Face] | undefined => {
    if (j === undefined) return undefined;
    const faces = [...new Set(g.slots[j].map((i) => FACES[Math.floor(i / 9)]))].filter((f) => f !== face);
    return faces.length === 2 ? [faces[0], faces[1]] : undefined;
  };

  const ollK = firstIndex((f) => allSolved(f, g.f2l) && allSolved(f, g.lastLayerFace), f2lK);

  const ids: StepId[] = ["cross", "f2l1", "f2l2", "f2l3", "f2l4", "oll", "pll"];
  const ends = [crossK, ...pairK, ollK, n];
  let start = 0;
  const steps = ids.map((id, i): StepSplit => {
    const end = Math.max(ends[i], start);
    const count = end - start;
    const split: StepSplit =
      count === 0
        ? { id, moves: 0, endMs: time(end), durationMs: 0, recognitionMs: 0, executionMs: 0, tps: null }
        : {
            id,
            moves: count,
            endMs: time(end),
            durationMs: time(end) - time(start),
            // La croix démarre au premier mouvement : pas de reconnaissance (c'est l'inspection).
            recognitionMs: start === 0 ? 0 : moves[start].t - time(start),
            executionMs: time(end) - moves[start].t,
            tps: tps(count, time(end) - moves[start].t),
          };
    if (i >= 1 && i <= 4) split.slot = slotFaces(pairSlot[i - 1]);
    start = end;
    return split;
  });

  // Reconnaissance des cas, dans le repère croix en bas.
  const toDown = (f: string) => (ROTATION_TO_DOWN[face] ? applyAlg(f, ROTATION_TO_DOWN[face]) : f);
  const oll = recognizeOll(toDown(states[pairK[3]]));
  const pll = recognizePll(toDown(states[ollK]));

  return {
    crossFace: face,
    steps,
    totalMs: time(n),
    totalMoves: n,
    tps: tps(n, time(n)),
    oll: oll === "skip" || oll === null ? oll : oll.id,
    pll: pll === "skip" || pll === null ? pll : pll.id,
  };
}
