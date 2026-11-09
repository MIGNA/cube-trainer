// Modèle du cube au niveau des 54 autocollants (« facelets »), au même format
// que celui envoyé par le cube GAN : chaîne de 54 lettres, ordre Kociemba
//   U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9
// chaque face lue ligne par ligne, vue de face :
//   U : vue de dessus, B en haut  ·  D : vue de dessous, F en haut
//   R, F, L, B : vue de face, U en haut
//
// Les permutations des 6 mouvements ne sont pas écrites à la main : elles sont
// calculées par géométrie (rotation 3D de chaque autocollant), donc sans risque
// de faute de frappe dans une table.

export const FACES = ["U", "R", "F", "D", "L", "B"] as const;
export type Face = (typeof FACES)[number];

export const SOLVED = FACES.map((f) => f.repeat(9)).join("");

type Vec = readonly [number, number, number];

/** Normale extérieure de chaque face (x : L→R, y : D→U, z : B→F). */
const NORMALS: Record<Face, Vec> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/** Position 3D de l'autocollant (ligne r, colonne c) d'une face, selon la convention ci-dessus. */
function position(face: Face, r: number, c: number): Vec {
  switch (face) {
    case "U": return [c - 1, 1, r - 1];
    case "R": return [1, 1 - r, 1 - c];
    case "F": return [c - 1, 1 - r, 1];
    case "D": return [c - 1, -1, 1 - r];
    case "L": return [-1, 1 - r, c - 1];
    case "B": return [1 - c, 1 - r, -1];
  }
}

const key = (p: Vec, n: Vec) => `${p.join(",")}|${n.join(",")}`;

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotation de -90° autour de l'axe unitaire a = quart de tour horaire vu depuis l'extérieur. */
function rotateClockwise(v: Vec, a: Vec): Vec {
  const c = cross(a, v);
  const d = dot(a, v);
  return [-c[0] + a[0] * d, -c[1] + a[1] * d, -c[2] + a[2] * d];
}

const STICKERS: { pos: Vec; normal: Vec }[] = [];
const INDEX = new Map<string, number>();
for (const face of FACES) {
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const pos = position(face, r, c);
      INDEX.set(key(pos, NORMALS[face]), STICKERS.length);
      STICKERS.push({ pos, normal: NORMALS[face] });
    }
  }
}

/** PERM[face][i] = indice où va l'autocollant i après un quart de tour horaire de `face`. */
const PERM = Object.fromEntries(
  FACES.map((face) => {
    const axis = NORMALS[face];
    const perm = STICKERS.map(({ pos, normal }, i) => {
      if (dot(pos, axis) !== 1) return i; // pas dans la couche tournée
      const target = INDEX.get(key(rotateClockwise(pos, axis), rotateClockwise(normal, axis)));
      if (target == null) throw new Error("permutation invalide");
      return target;
    });
    return [face, perm];
  }),
) as Record<Face, number[]>;

export interface Turn {
  face: Face;
  /** Nombre de quarts de tour horaires : 1 = R, 2 = R2, 3 = R'. */
  amount: 1 | 2 | 3;
}

export function parseMove(move: string): Turn {
  const m = /^([URFDLB])(2|'|2')?$/.exec(move.trim());
  if (!m) throw new Error(`Mouvement non géré : "${move}"`);
  const amount = m[2] === "'" ? 3 : m[2]?.startsWith("2") ? 2 : 1;
  return { face: m[1] as Face, amount };
}

export function formatTurn(turn: Turn): string {
  return turn.face + (turn.amount === 1 ? "" : turn.amount === 2 ? "2" : "'");
}

export function parseAlg(alg: string): Turn[] {
  return alg.split(/\s+/).filter(Boolean).map(parseMove);
}

export function invertAlg(alg: string): string {
  return parseAlg(alg)
    .reverse()
    .map((t) => formatTurn({ face: t.face, amount: (4 - t.amount) as Turn["amount"] }))
    .join(" ");
}

export function applyTurn(facelets: string, turn: Turn): string {
  let current = facelets;
  for (let k = 0; k < turn.amount; k++) {
    const next = new Array<string>(54);
    const perm = PERM[turn.face];
    for (let i = 0; i < 54; i++) next[perm[i]] = current[i];
    current = next.join("");
  }
  return current;
}

export function applyMove(facelets: string, move: string): string {
  return applyTurn(facelets, parseMove(move));
}

export function applyAlg(facelets: string, alg: string): string {
  return parseAlg(alg).reduce(applyTurn, facelets);
}

/** Résolu = chaque face d'une seule couleur (indépendant de l'orientation globale). */
export function isSolved(facelets: string): boolean {
  for (let f = 0; f < 6; f++) {
    const face = facelets.slice(f * 9, f * 9 + 9);
    if (face !== face[4].repeat(9)) return false;
  }
  return true;
}

export function isValidFacelets(facelets: string): boolean {
  if (facelets.length !== 54) return false;
  return FACES.every((f) => facelets.split(f).length - 1 === 9);
}
