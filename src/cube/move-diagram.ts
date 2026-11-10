// Données d'un dessin de mouvement (page Notation) : cube vu de trois quarts
// (faces U, F, R visibles), couche qui tourne, flèche du sens de rotation.
//
// Repère 3D : X vers la droite (R), Y vers le haut (U), Z vers soi (F) ; cube de 0 à 3,
// cubies d'indices 0 à 2 sur chaque axe. Le dessin lui-même est dans src/ui/move-svg.ts.

export type Vec3 = [number, number, number];
type Axis = 0 | 1 | 2; // X, Y, Z

export interface MoveDiagram {
  /** Axe de rotation et couches (indices de cubies) qui tournent. */
  axis: Axis;
  layers: number[];
  /** Flèche (points 3D sur les faces visibles), du départ vers la pointe. */
  path: Vec3[];
  /** Demi-tour (R2…). */
  twice: boolean;
}

// dir = +1 : même sens que R (axe X), U (axe Y) ou F (axe Z).
const MOVES: Record<string, { axis: Axis; layers: number[]; dir: 1 | -1 }> = {
  R: { axis: 0, layers: [2], dir: 1 },
  L: { axis: 0, layers: [0], dir: -1 },
  M: { axis: 0, layers: [1], dir: -1 },
  r: { axis: 0, layers: [1, 2], dir: 1 },
  l: { axis: 0, layers: [0, 1], dir: -1 },
  x: { axis: 0, layers: [0, 1, 2], dir: 1 },
  U: { axis: 1, layers: [2], dir: 1 },
  D: { axis: 1, layers: [0], dir: -1 },
  E: { axis: 1, layers: [1], dir: -1 },
  u: { axis: 1, layers: [1, 2], dir: 1 },
  d: { axis: 1, layers: [0, 1], dir: -1 },
  y: { axis: 1, layers: [0, 1, 2], dir: 1 },
  F: { axis: 2, layers: [2], dir: 1 },
  B: { axis: 2, layers: [0], dir: -1 },
  S: { axis: 2, layers: [1], dir: 1 },
  f: { axis: 2, layers: [1, 2], dir: 1 },
  b: { axis: 2, layers: [0, 1], dir: -1 },
  z: { axis: 2, layers: [0, 1, 2], dir: 1 },
};

// Trajet de la flèche dans le sens +1, à la coordonnée c (milieu des couches) :
// R : l'avant monte puis part vers l'arrière ; U : la droite vient vers l'avant puis
// part à gauche ; F : le haut part à droite puis descend.
const PATHS: Record<Axis, (c: number) => Vec3[]> = {
  0: (c) => [[c, 0.4, 3], [c, 3, 3], [c, 3, 0.4]],
  1: (c) => [[3, c, 0.4], [3, c, 3], [0.4, c, 3]],
  2: (c) => [[0.4, 3, c], [3, 3, c], [3, 0.4, c]],
};

/** Dessin d'un mouvement ("R", "U'", "M2", "Rw", "y"…). */
export function moveDiagram(move: string): MoveDiagram {
  const m = /^([URFDLBMESxyzurfdlb])(w?)(['2]?)$/.exec(move.trim());
  if (!m) throw new Error(`Mouvement inconnu : ${move}`);
  const base = m[2] ? m[1].toLowerCase() : m[1];
  const def = MOVES[base];
  if (!def) throw new Error(`Mouvement inconnu : ${move}`);
  const dir = m[3] === "'" ? -def.dir : def.dir;
  const c = def.layers.reduce((a, b) => a + b, 0) / def.layers.length + 0.5;
  const path = PATHS[def.axis](c);
  return { axis: def.axis, layers: def.layers, path: dir === 1 ? path : path.reverse(), twice: m[3] === "2" };
}

/** Le cubie (indices 0 à 2) fait-il partie des couches qui tournent ? */
export function inLayer(d: MoveDiagram, cubie: Vec3): boolean {
  return d.layers.includes(cubie[d.axis]);
}

export interface Sticker {
  face: "U" | "F" | "R";
  cubie: Vec3;
  /** Coins 3D de l'autocollant. */
  corners: Vec3[];
}

/** Les 27 autocollants visibles (faces U, F, R). */
export function visibleStickers(): Sticker[] {
  const out: Sticker[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out.push({ face: "U", cubie: [i, 2, j], corners: [[i, 3, j], [i + 1, 3, j], [i + 1, 3, j + 1], [i, 3, j + 1]] });
      out.push({ face: "F", cubie: [i, j, 2], corners: [[i, j, 3], [i + 1, j, 3], [i + 1, j + 1, 3], [i, j + 1, 3]] });
      out.push({ face: "R", cubie: [2, i, j], corners: [[3, i, j], [3, i + 1, j], [3, i + 1, j + 1], [3, i, j + 1]] });
    }
  }
  return out;
}

/** Projection isométrique (vue de devant, à droite, en haut) ; y vers le bas comme en SVG. */
export function project([x, y, z]: Vec3): [number, number] {
  return [(x - z) * 0.866, (x + z) * 0.5 - y];
}
