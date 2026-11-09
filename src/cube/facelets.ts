// Modèle du cube au niveau des 54 autocollants (« facelets »), au même format
// que celui envoyé par le cube GAN : chaîne de 54 lettres, ordre Kociemba
//   U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9
// chaque face lue ligne par ligne, vue de face :
//   U : vue de dessus, B en haut  ·  D : vue de dessous, F en haut
//   R, F, L, B : vue de face, U en haut
//
// Les permutations des mouvements ne sont pas écrites à la main : elles sont
// calculées par géométrie (rotation 3D de chaque autocollant), donc sans risque
// de faute de frappe dans une table. Notation gérée : faces (R), doubles couches
// (r, Rw), tranches (M E S), rotations (x y z), suffixes ' 2 2'.

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

export const OPPOSITE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };

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

// --- Mouvements ----------------------------------------------------------

/**
 * Un mouvement = rotation horaire (vue depuis la face `axis`) des couches dont
 * la profondeur (position · normale) est comprise entre min et max :
 * 1 = couche extérieure, 0 = tranche du milieu, -1 = couche opposée.
 */
interface LayerSpec {
  axis: Face;
  min: number;
  max: number;
}

const MOVE_SPECS: Record<string, LayerSpec> = {
  ...Object.fromEntries(FACES.map((f) => [f, { axis: f, min: 1, max: 1 }])),
  ...Object.fromEntries(FACES.map((f) => [f.toLowerCase(), { axis: f, min: 0, max: 1 }])),
  M: { axis: "L", min: 0, max: 0 },
  E: { axis: "D", min: 0, max: 0 },
  S: { axis: "F", min: 0, max: 0 },
  x: { axis: "R", min: -1, max: 1 },
  y: { axis: "U", min: -1, max: 1 },
  z: { axis: "F", min: -1, max: 1 },
};

const permCache = new Map<string, number[]>();

/** perm[i] = indice où va l'autocollant i après un quart de tour horaire. */
function permutation(spec: LayerSpec): number[] {
  const cacheKey = `${spec.axis}${spec.min}${spec.max}`;
  let perm = permCache.get(cacheKey);
  if (!perm) {
    const axis = NORMALS[spec.axis];
    perm = STICKERS.map(({ pos, normal }, i) => {
      const depth = dot(pos, axis);
      if (depth < spec.min || depth > spec.max) return i;
      const target = INDEX.get(key(rotateClockwise(pos, axis), rotateClockwise(normal, axis)));
      if (target == null) throw new Error("permutation invalide");
      return target;
    });
    permCache.set(cacheKey, perm);
  }
  return perm;
}

export interface Move {
  /** Nom de base : "R", "r", "M", "x"… (Rw est normalisé en r). */
  base: string;
  /** Nombre de quarts de tour horaires : 1 = R, 2 = R2, 3 = R'. */
  amount: 1 | 2 | 3;
}

export function parseAnyMove(move: string): Move {
  const m = /^([URFDLB]w?|[urfdlbMESxyz])(2'|2|')?$/.exec(move.trim());
  if (!m) throw new Error(`Mouvement non géré : "${move}"`);
  const base = m[1].endsWith("w") ? m[1][0].toLowerCase() : m[1];
  const amount = m[2] === "'" ? 3 : m[2] ? 2 : 1;
  return { base, amount };
}

export function formatMove(move: Move): string {
  return move.base + (move.amount === 1 ? "" : move.amount === 2 ? "2" : "'");
}

/** Découpe un algo en mouvements (les parenthèses sont ignorées). */
export function parseAnyAlg(alg: string): Move[] {
  return alg.replace(/[()]/g, " ").split(/\s+/).filter(Boolean).map(parseAnyMove);
}

export function invertAlg(alg: string): string {
  return parseAnyAlg(alg)
    .reverse()
    .map((m) => formatMove({ base: m.base, amount: (4 - m.amount) as Move["amount"] }))
    .join(" ");
}

function applyParsed(facelets: string, move: Move): string {
  const perm = permutation(MOVE_SPECS[move.base]);
  let current = facelets;
  for (let k = 0; k < move.amount; k++) {
    const next = new Array<string>(54);
    for (let i = 0; i < 54; i++) next[perm[i]] = current[i];
    current = next.join("");
  }
  return current;
}

export function applyMove(facelets: string, move: string): string {
  return applyParsed(facelets, parseAnyMove(move));
}

export function applyAlg(facelets: string, alg: string): string {
  return parseAnyAlg(alg).reduce(applyParsed, facelets);
}

// --- Mouvements de face uniquement (ce que le cube connecté envoie) -------

export interface Turn {
  face: Face;
  amount: 1 | 2 | 3;
}

/** Mouvement d'une face extérieure (R, U'…), seuls mouvements des mélanges et du cube. */
export function parseMove(move: string): Turn {
  const m = /^([URFDLB])(2'|2|')?$/.exec(move.trim());
  if (!m) throw new Error(`Mouvement non géré : "${move}"`);
  const amount = m[2] === "'" ? 3 : m[2] ? 2 : 1;
  return { face: m[1] as Face, amount };
}

export function formatTurn(turn: Turn): string {
  return formatMove({ base: turn.face, amount: turn.amount });
}

export function parseAlg(alg: string): Turn[] {
  return alg.split(/\s+/).filter(Boolean).map(parseMove);
}

export function applyTurn(facelets: string, turn: Turn): string {
  return applyParsed(facelets, { base: turn.face, amount: turn.amount });
}

// --- États ----------------------------------------------------------------

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

/** L'autocollant i a la couleur du centre de sa face. */
export function stickerSolved(facelets: string, i: number): boolean {
  return facelets[i] === facelets[Math.floor(i / 9) * 9 + 4];
}

export function allSolved(facelets: string, stickers: readonly number[]): boolean {
  return stickers.every((i) => stickerSolved(facelets, i));
}

// --- Groupes d'autocollants pour l'analyse CFOP ---------------------------

/**
 * Groupes relatifs à une face de croix X :
 * - cross : les 4 arêtes de la couche X ;
 * - slots : les 4 emplacements F2L (coin de la couche X + arête du milieu) ;
 * - f2l : les deux premières couches entières ;
 * - lastLayerFace : les 9 autocollants de la face opposée (pour l'OLL).
 */
export interface CrossGroups {
  cross: number[];
  slots: number[][];
  f2l: number[];
  lastLayerFace: number[];
}

const nonZero = (p: Vec) => p.filter((v) => v !== 0).length;

export const CROSS_GROUPS = Object.fromEntries(
  FACES.map((face) => {
    const n = NORMALS[face];
    const cross: number[] = [];
    const f2l: number[] = [];
    const slotMap = new Map<string, number[]>();

    STICKERS.forEach(({ pos }, i) => {
      const depth = dot(pos, n);
      if (depth < 0) return;
      f2l.push(i);
      if (depth === 1 && nonZero(pos) === 2) cross.push(i);
      // Un emplacement F2L = la colonne verticale (perpendiculaire à X) d'un coin.
      const lateral = pos.map((v, k) => (n[k] === 0 ? v : 0));
      const isSlotPiece = (depth === 1 && nonZero(pos) === 3) || (depth === 0 && nonZero(pos) === 2);
      if (isSlotPiece && nonZero(lateral as unknown as Vec) === 2) {
        const k = lateral.join(",");
        slotMap.set(k, [...(slotMap.get(k) ?? []), i]);
      }
    });

    const opp = FACES.indexOf(OPPOSITE[face]);
    const lastLayerFace = Array.from({ length: 9 }, (_, k) => opp * 9 + k);
    return [face, { cross, slots: [...slotMap.values()], f2l, lastLayerFace }];
  }),
) as Record<Face, CrossGroups>;

/** Rotation du cube entier qui amène la face X en bas (D). */
export const ROTATION_TO_DOWN: Record<Face, string> = {
  D: "",
  U: "x2",
  F: "x'",
  B: "x",
  R: "z",
  L: "z'",
};
