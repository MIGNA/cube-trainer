// Lecture des pièces (arêtes, coins) d'un état facelets, et conversion vers le
// format du solveur de cubing.js (KPattern).
//
// Ordre des pièces = ordre « Reid » utilisé par cubing.js. Pour chaque pièce, les
// autocollants sont listés dans l'ordre de son nom (UFR = U, F, R) ; le premier est
// l'autocollant de référence pour l'orientation. Les tests comparent la conversion
// avec cubing.js sur des mélanges aléatoires.

export const EDGES: readonly (readonly number[])[] = [
  [7, 19], // UF
  [5, 10], // UR
  [1, 46], // UB
  [3, 37], // UL
  [28, 25], // DF
  [32, 16], // DR
  [34, 52], // DB
  [30, 43], // DL
  [23, 12], // FR
  [21, 41], // FL
  [48, 14], // BR
  [50, 39], // BL
];

export const CORNERS: readonly (readonly number[])[] = [
  [8, 20, 9], // UFR
  [2, 11, 45], // URB
  [0, 47, 36], // UBL
  [6, 38, 18], // ULF
  [29, 15, 26], // DRF
  [27, 24, 44], // DFL
  [33, 42, 53], // DLB
  [35, 51, 17], // DBR
];

export interface OrbitState {
  /** pieces[slot] = pièce présente à cet emplacement. */
  pieces: number[];
  /** Torsion : l'autocollant de référence de l'emplacement porte l'autocollant n° orientation[slot] de la pièce. */
  orientation: number[];
}

/**
 * Lit les pièces d'une orbite. Les couleurs sont comparées aux centres de `facelets`,
 * donc l'état doit avoir les centres fixes (cube connecté, mouvements de faces).
 */
export function readOrbit(facelets: string, orbit: readonly (readonly number[])[]): OrbitState {
  const centerOf = (i: number) => facelets[Math.floor(i / 9) * 9 + 4];
  // Couleurs de chaque pièce résolue, dans l'ordre de ses autocollants.
  const home = orbit.map((stickers) => stickers.map(centerOf));
  const pieces: number[] = [];
  const orientation: number[] = [];
  for (const stickers of orbit) {
    const colors = stickers.map((i) => facelets[i]);
    let found = false;
    for (let piece = 0; piece < orbit.length && !found; piece++) {
      for (let twist = 0; twist < stickers.length; twist++) {
        if (colors.every((c, k) => c === home[piece][(k + twist) % stickers.length])) {
          pieces.push(piece);
          orientation.push(twist);
          found = true;
          break;
        }
      }
    }
    if (!found) throw new Error("état du cube invalide");
  }
  return { pieces, orientation };
}

/** Inverse de readOrbit : écrit les pièces dans `facelets` (centres conservés). */
export function writeOrbit(facelets: string[], orbit: readonly (readonly number[])[], state: OrbitState): void {
  const centerOf = (i: number) => facelets[Math.floor(i / 9) * 9 + 4];
  const home = orbit.map((stickers) => stickers.map(centerOf));
  orbit.forEach((stickers, slot) => {
    const piece = state.pieces[slot];
    stickers.forEach((i, k) => (facelets[i] = home[piece][(k + state.orientation[slot]) % stickers.length]));
  });
}
