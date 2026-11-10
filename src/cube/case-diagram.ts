// Données d'un schéma de dernière couche (vue de dessus) : couleurs de la face U,
// des bords (rangées du haut de F, R, B, L) et flèches de permutation pour les PLL.
//
// Les couleurs sont exprimées par POSITION (« la couleur du centre F »…) et non par
// lettre, pour rester justes si l'algo contient une rotation (y…).

import { SOLVED, applyAlg, invertAlg, type Face } from "./facelets";

export type SideFace = "F" | "R" | "B" | "L";

export interface LastLayerView {
  /** 9 cases de la face U (ligne 0 = côté B, ligne 2 = côté F), chacune = face d'origine de la couleur. */
  top: Face[];
  /** Bords, dans l'ordre de dessin : B et F de gauche à droite, L et R de haut (arrière) en bas (avant). */
  sides: Record<SideFace, Face[]>;
  /** Flèches [case de départ, case d'arrivée] sur la face U (vide si rien n'est permuté). */
  arrows: [number, number][];
}

// Indices Kociemba des autocollants latéraux, dans l'ordre de dessin.
const SIDE_STICKERS: Record<SideFace, number[]> = {
  B: [47, 46, 45],
  F: [18, 19, 20],
  L: [36, 37, 38],
  R: [11, 10, 9],
};

// Arêtes : case de U → autocollant latéral, et face → case.
const EDGE_SIDE: Record<number, number> = { 1: 46, 3: 37, 5: 10, 7: 19 };
const EDGE_CELL: Record<SideFace, number> = { B: 1, L: 3, R: 5, F: 7 };
// Coins : case de U → autocollants latéraux, et faces du coin.
const CORNER_SIDES: Record<number, [number, number]> = { 0: [36, 47], 2: [45, 11], 6: [18, 38], 8: [9, 20] };
const CORNER_FACES: Record<number, [SideFace, SideFace]> = { 0: ["L", "B"], 2: ["B", "R"], 6: ["F", "L"], 8: ["R", "F"] };

const POSITIONS: Face[] = ["U", "R", "F", "D", "L", "B"];

export function lastLayerView(facelets: string): LastLayerView {
  // lettre → position dont le centre porte cette lettre
  const byLetter = new Map(POSITIONS.map((pos, i) => [facelets[i * 9 + 4], pos]));
  const at = (i: number) => byLetter.get(facelets[i])!;

  const top = Array.from({ length: 9 }, (_, i) => at(i));
  const sides = Object.fromEntries(
    (Object.keys(SIDE_STICKERS) as SideFace[]).map((f) => [f, SIDE_STICKERS[f].map(at)]),
  ) as Record<SideFace, Face[]>;

  // Flèches seulement si la couche est orientée (sinon les pièces ne se lisent pas par leurs côtés).
  const arrows: [number, number][] = [];
  if (top.every((f) => f === "U")) {
    for (const [cell, sticker] of Object.entries(EDGE_SIDE)) {
      const target = EDGE_CELL[at(sticker) as SideFace];
      if (target !== Number(cell)) arrows.push([Number(cell), target]);
    }
    for (const [cell, stickers] of Object.entries(CORNER_SIDES)) {
      const faces = stickers.map(at);
      const target = Number(Object.entries(CORNER_FACES).find(([, fs]) => fs.every((f) => faces.includes(f)))![0]);
      if (target !== Number(cell)) arrows.push([Number(cell), target]);
    }
  }
  return { top, sides, arrows };
}

/** Longueur du plus grand cycle formé par les flèches (0 si aucune). */
function longestCycle(arrows: [number, number][]): number {
  const next = new Map(arrows);
  let longest = 0;
  for (const [start] of arrows) {
    let len = 0;
    let cur: number | undefined = start;
    do {
      cur = next.get(cur!);
      len++;
    } while (cur !== undefined && cur !== start && len <= 8);
    longest = Math.max(longest, len);
  }
  return longest;
}

/**
 * Schéma d'un cas défini par l'algo qui le résout.
 * Un algo peut supposer la couche U déjà tournée (AUF) : on essaie les 4 rotations
 * de U et on garde celle qui déplace le moins de pièces, puis, à égalité, celle aux
 * cycles les plus courts (G-perm : 3 coins + 3 arêtes plutôt que 4 arêtes + 2 coins).
 * C'est la convention des schémas usuels (jperm.net, wiki speedsolving).
 */
export function caseView(alg: string): LastLayerView {
  const state = applyAlg(SOLVED, invertAlg(alg));
  const views = ["", "U", "U2", "U'"].map((auf) => lastLayerView(auf ? applyAlg(state, auf) : state));
  const score = (v: LastLayerView) => v.arrows.length * 10 + longestCycle(v.arrows);
  return views.reduce((best, v) => (score(v) < score(best) ? v : best));
}
