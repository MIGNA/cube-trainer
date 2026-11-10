// Set-up d'un cas OLL/PLL.
//
// - shortestSetup() : depuis le cube résolu, le plus court parmi les algos connus du
//   cas, inversés et réécrits en tours de faces uniquement (pas de rotation ni de
//   mouvement large : le cube reste tenu jaune en haut, vert devant).
// - setupFromState() : depuis l'état actuel du cube connecté, via le solveur de cubing.js.
//
// Deux repères :
// - « joueur » : dernière couche (jaune) en haut, vert devant — celui des schémas et des algos ;
// - « cube » : celui du cube GAN, blanc en haut, vert devant (= joueur après z2).
// Passer de l'un à l'autre échange U↔D et R↔L (TO_CUBE).

import { caseView, lastLayerView, type LastLayerView } from "./case-diagram";
import { caseKind, checkCaseAlg, type CaseDef, type CaseKind } from "./cases";
import { FACES, OPPOSITE, SOLVED, applyAlg, formatTurn, invertAlg, isSolved, parseAlg, parseAnyAlg, type Face, type Turn } from "./facelets";
import { CORNERS, EDGES, readOrbit, type OrbitState } from "./pieces";

// --- Réécriture en tours de faces ----------------------------------------

/** Mouvements larges / tranches = tour de face + rotation (quart de tour horaire). */
const EXPANSIONS: Record<string, string> = {
  r: "L x",
  l: "R x'",
  u: "D y",
  d: "U y'",
  f: "B z",
  b: "F z'",
  M: "R L' x'",
  E: "U D' y'",
  S: "F' B z",
};
const ROTATIONS = new Set(["x", "y", "z"]);

// État de test sans symétrie, pour identifier un tour de face par son effet.
const PROBE = applyAlg(SOLVED, "R U2 F' L D' B2 R' U F2 D L'");
const conjugateCache = new Map<string, string>();

/** Tour de face G tel que « Q⁻¹ F Q » = G (Q = suite de rotations). */
function conjugate(face: string, rotation: string): string {
  if (!rotation) return face;
  const key = `${face}|${rotation}`;
  let g = conjugateCache.get(key);
  if (!g) {
    const target = applyAlg(PROBE, `${invertAlg(rotation)} ${face} ${rotation}`);
    g = FACES.find((f) => applyAlg(PROBE, f) === target);
    if (!g) throw new Error("conjugaison impossible");
    conjugateCache.set(key, g);
  }
  return g;
}

/**
 * Réécrit un algo en tours de faces seulement, à une rotation du cube près
 * (les rotations sont ramenées au début puis supprimées : elles changent la façon
 * de tenir le cube, pas le cas).
 */
export function toFaceTurns(alg: string): Turn[] {
  // Quarts de tour élémentaires.
  const quarters: string[] = [];
  for (const m of parseAnyAlg(alg)) {
    for (let k = 0; k < m.amount; k++) {
      const exp = EXPANSIONS[m.base];
      quarters.push(...(exp ? exp.split(" ") : [m.base]));
    }
  }
  // De droite à gauche : suffixe = Q · G (rotations Q devant, tours G derrière).
  // Ajouter un tour F devant : F·Q·G = Q·(Q⁻¹FQ)·G.
  let rotation = "";
  const faces: string[] = [];
  for (let i = quarters.length - 1; i >= 0; i--) {
    const q = quarters[i];
    const base = q[0];
    if (ROTATIONS.has(base)) rotation = `${q} ${rotation}`.trim();
    else {
      const inverse = q.endsWith("'");
      const g = conjugate(base, rotation);
      faces.unshift(inverse ? `${g}'` : g);
    }
  }
  return mergeTurns(faces.map((m) => parseAlg(m)[0]));
}

/** Regroupe les tours d'une même face (R R → R2, R R' → rien), y compris à travers la face opposée (R L R → R2 L). */
export function mergeTurns(turns: readonly Turn[]): Turn[] {
  const out: Turn[] = [];
  for (const t of turns) {
    const last = out.length - 1;
    let target = -1;
    if (last >= 0 && out[last].face === t.face) target = last;
    else if (last >= 1 && out[last].face === OPPOSITE[t.face] && out[last - 1].face === t.face) target = last - 1;
    if (target < 0) {
      out.push({ ...t });
      continue;
    }
    const amount = (out[target].amount + t.amount) % 4;
    if (amount === 0) out.splice(target, 1);
    else out[target] = { face: t.face, amount: amount as Turn["amount"] };
  }
  return out;
}

const formatTurns = (turns: readonly Turn[]) => turns.map(formatTurn).join(" ");

// --- Set-up depuis le cube résolu ------------------------------------------

const AUFS = ["", "U", "U2", "U'"];
const Y_TURNS = ["", "y", "y2", "y'"];

/**
 * Clé de comparaison de deux schémas : motif jaune pour une OLL, motif jaune des
 * arêtes seules pour une croix, schéma complet pour une PLL.
 */
export function viewKey(view: LastLayerView, kind: CaseKind): string {
  if (kind === "pll") return JSON.stringify(view);
  const yellow = (faces: Face[]) => faces.map((f) => (f === "U" ? 1 : 0)).join("");
  if (kind === "eo") {
    const top = [1, 3, 5, 7].map((i) => view.top[i]);
    return [top, ...(["B", "F", "L", "R"] as const).map((s) => [view.sides[s][1]])].map(yellow).join("|");
  }
  return [view.top, view.sides.B, view.sides.F, view.sides.L, view.sides.R].map(yellow).join("|");
}

/**
 * Set-up le plus court (repère joueur) parmi les algos donnés, réglé pour que
 * le cas apparaisse sous le même angle que son schéma.
 */
export function shortestSetup(c: CaseDef, algs: readonly string[]): string {
  const kind = caseKind(c);
  const diagram = viewKey(caseView(c.alg), kind);
  let best: Turn[] | null = null;
  for (const alg of algs) {
    const turns = toFaceTurns(invertAlg(alg));
    // Les U du début et de la fin ne changent pas le cas, seulement son angle.
    while (turns[0]?.face === "U") turns.shift();
    while (turns.at(-1)?.face === "U") turns.pop();
    // Angle du schéma : le même set-up vu depuis une autre face (y), puis un AUF final.
    let setup: Turn[] | null = null;
    for (const y of Y_TURNS) {
      const turned = turns.map((t) => ({ face: conjugate(t.face, y) as Face, amount: t.amount }));
      const base = formatTurns(turned);
      const auf = AUFS.find((a) => viewKey(lastLayerView(applyAlg(SOLVED, `${base} ${a}`.trim())), kind) === diagram);
      if (auf !== undefined) {
        setup = auf ? [...turned, parseAlg(auf)[0]] : turned;
        break;
      }
    }
    if (!setup || !checkCaseAlg(c, invertAlg(formatTurns(setup))).ok) continue;
    if (!best || setup.length < best.length) best = setup;
  }
  return best ? formatTurns(best) : invertAlg(c.alg);
}

// --- Repères joueur / cube -----------------------------------------------

/** Face du repère cube correspondant à une face du repère joueur (et inversement : z2 est sa propre inverse). */
export const TO_CUBE: Record<Face, Face> = { U: "D", D: "U", R: "L", L: "R", F: "F", B: "B" };

/** Change de repère une suite de tours de faces (joueur ↔ cube). */
export function switchFrame(alg: string): string {
  return formatTurns(parseAlg(alg).map((t) => ({ face: TO_CUBE[t.face], amount: t.amount })));
}

/** État du cube vu dans le repère joueur (jaune en haut). */
export function toPlayerView(cubeFacelets: string): string {
  return applyAlg(cubeFacelets, "z2");
}

// --- Set-up depuis l'état actuel ---------------------------------------------

/** Composition d'orbites : état X vu avec les pièces de W (voir setupFromState). */
function compose(x: OrbitState, w: OrbitState, mod: number): OrbitState {
  return {
    pieces: x.pieces.map((p) => w.pieces[p]),
    orientation: x.pieces.map((p, j) => (x.orientation[j] + w.orientation[p]) % mod),
  };
}

/**
 * Mouvements (repère cube) qui amènent le cube de l'état `current` (repère cube,
 * centres fixes) au cas préparé par `setup` (repère joueur, depuis le cube résolu).
 */
export async function setupFromState(current: string, setup: string): Promise<string> {
  const setupCube = switchFrame(setup);

  // Cube résolu à un tour de la couche jaune près : le set-up suffit.
  for (const k of [0, 1, 2, 3]) {
    const d = ["", "D", "D2", "D'"][k];
    if (isSolved(d ? applyAlg(current, d) : current)) {
      return formatTurns(mergeTurns(parseAlg(`${d} ${setupCube}`.trim())));
    }
  }

  // Sinon : on cherche M tel que current · M = résolu · setup (à un AUF près).
  // Si current = résolu · x, alors M = x⁻¹ · setup, qui est la solution de l'état
  // Z = résolu · setup⁻¹ · x : les pièces de X « vues à travers » W = résolu · setup⁻¹.
  const [{ KPattern }, { cube3x3x3 }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import("cubing/kpuzzle"),
    import("cubing/puzzles"),
    import("cubing/search"),
  ]);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const x = { e: readOrbit(current, EDGES), c: readOrbit(current, CORNERS) };
  let best: Turn[] | null = null;
  for (const auf of ["", "D", "D2", "D'"]) {
    const w = applyAlg(SOLVED, invertAlg(`${setupCube} ${auf}`.trim()));
    const pattern = new KPattern(kpuzzle, {
      EDGES: compose(x.e, readOrbit(w, EDGES), 2),
      CORNERS: compose(x.c, readOrbit(w, CORNERS), 3),
      CENTERS: kpuzzle.defaultPattern().patternData.CENTERS,
    });
    const solution = mergeTurns(parseAlg((await experimentalSolve3x3x3IgnoringCenters(pattern)).toString()));
    if (!best || solution.length < best.length) best = solution;
  }
  return formatTurns(best!);
}
