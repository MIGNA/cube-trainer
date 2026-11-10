// Tables des cas OLL (57) et PLL (21), des 3 cas de croix du 2-look (orientation
// des arêtes), et leur reconnaissance.
//
// Chaque cas est défini par un algorithme standard qui le résout (croix en bas,
// dernière couche en haut). L'état du cas = cube résolu + algo inversé.
// Les tests vérifient que chaque algo préserve les F2L, résout bien son cas et
// que tous les cas sont distincts.
//
// Reconnaissance : on calcule une « signature » de la dernière couche, invariante
// par rotation de la couche U (AUF) et du cube autour de l'axe vertical (y).

import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, invertAlg, parseAnyAlg } from "./facelets";

export interface CaseDef {
  id: string;
  name: string;
  alg: string;
}

/** Famille d'un cas : croix jaune (1er temps de l'OLL 2-look), OLL ou PLL. */
export type CaseKind = "eo" | "oll" | "pll";

// 2-look OLL, 1er temps : orienter les arêtes (croix jaune). Seules les arêtes
// comptent ; les coins de l'état du cas sont quelconques.
export const EO_CASES: CaseDef[] = [
  { id: "Croix point", name: "Point", alg: "F R U R' U' F' f R U R' U' f'" },
  { id: "Croix L", name: "L", alg: "f R U R' U' f'" },
  { id: "Croix ligne", name: "Ligne", alg: "F R U R' U' F'" },
];

export const OLL_CASES: CaseDef[] = [
  // Point (aucune arête orientée)
  { id: "OLL 1", name: "Point", alg: "R U2 R2 F R F' U2 R' F R F'" },
  { id: "OLL 2", name: "Point", alg: "F R U R' U' F' f R U R' U' f'" },
  { id: "OLL 3", name: "Point", alg: "f R U R' U' f' U' F R U R' U' F'" },
  { id: "OLL 4", name: "Point", alg: "f R U R' U' f' U F R U R' U' F'" },
  { id: "OLL 17", name: "Point", alg: "R U R' U R' F R F' U2 R' F R F'" },
  { id: "OLL 18", name: "Point", alg: "r U R' U R U2 r2 U' R U' R' U2 r" },
  { id: "OLL 19", name: "Point", alg: "M U R U R' U' M' R' F R F'" },
  { id: "OLL 20", name: "Point", alg: "r U R' U' M2 U R U' R' U' M'" },
  // Carré
  { id: "OLL 5", name: "Carré", alg: "r' U2 R U R' U r" },
  { id: "OLL 6", name: "Carré", alg: "r U2 R' U' R U' r'" },
  // Éclair
  { id: "OLL 7", name: "Éclair", alg: "r U R' U R U2 r'" },
  { id: "OLL 8", name: "Éclair", alg: "r' U' R U' R' U2 r" },
  { id: "OLL 11", name: "Éclair", alg: "r U R' U R' F R F' R U2 r'" },
  { id: "OLL 12", name: "Éclair", alg: "M' R' U' R U' R' U2 R U' R r'" },
  { id: "OLL 39", name: "Éclair", alg: "L F' L' U' L U F U' L'" },
  { id: "OLL 40", name: "Éclair", alg: "R' F R U R' U' F' U R" },
  // Poisson
  { id: "OLL 9", name: "Poisson", alg: "R U R' U' R' F R2 U R' U' F'" },
  { id: "OLL 10", name: "Poisson", alg: "R U R' U R' F R F' R U2 R'" },
  { id: "OLL 35", name: "Poisson", alg: "R U2 R2 F R F' R U2 R'" },
  { id: "OLL 37", name: "Poisson", alg: "F R' F' R U R U' R'" },
  // Cavalier
  { id: "OLL 13", name: "Cavalier", alg: "F U R U' R2 F' R U R U' R'" },
  { id: "OLL 14", name: "Cavalier", alg: "R' F R U R' F' R F U' F'" },
  { id: "OLL 15", name: "Cavalier", alg: "r' U' r R' U' R U r' U r" },
  { id: "OLL 16", name: "Cavalier", alg: "r U r' R U R' U' r U' r'" },
  // Awkward
  { id: "OLL 29", name: "Awkward", alg: "R U R' U' R U' R' F' U' F R U R'" },
  { id: "OLL 30", name: "Awkward", alg: "F R' F R2 U' R' U' R U R' F2" },
  { id: "OLL 41", name: "Awkward", alg: "R U R' U R U2 R' F R U R' U' F'" },
  { id: "OLL 42", name: "Awkward", alg: "R' U' R U' R' U2 R F R U R' U' F'" },
  // P
  { id: "OLL 31", name: "P", alg: "R' U' F U R U' R' F' R" },
  { id: "OLL 32", name: "P", alg: "L U F' U' L' U L F L'" },
  { id: "OLL 43", name: "P", alg: "F' U' L' U L F" },
  { id: "OLL 44", name: "P", alg: "F U R U' R' F'" },
  // T
  { id: "OLL 33", name: "T", alg: "R U R' U' R' F R F'" },
  { id: "OLL 45", name: "T", alg: "F R U R' U' F'" },
  // C
  { id: "OLL 34", name: "C", alg: "R U R2 U' R' F R U R U' F'" },
  { id: "OLL 46", name: "C", alg: "R' U' R' F R F' U R" },
  // W
  { id: "OLL 36", name: "W", alg: "L' U' L U' L' U L U L F' L' F" },
  { id: "OLL 38", name: "W", alg: "R U R' U R U' R' U' R' F R F'" },
  // Coins orientés
  { id: "OLL 28", name: "Coins orientés", alg: "r U R' U' r' R U R U' R'" },
  { id: "OLL 57", name: "Coins orientés", alg: "R U R' U' M' U R U' r'" },
  // I
  { id: "OLL 51", name: "I", alg: "F U R U' R' U R U' R' F'" },
  { id: "OLL 52", name: "I", alg: "R U R' U R U' B U' B' R'" },
  { id: "OLL 55", name: "I", alg: "R' F R U R U' R2 F' R2 U' R' U R U R'" },
  { id: "OLL 56", name: "I", alg: "r' U' r U' R' U R U' R' U R r' U r" },
  // Petit L
  { id: "OLL 47", name: "Petit L", alg: "R' U' R' F R F' R' F R F' U R" },
  { id: "OLL 48", name: "Petit L", alg: "F R U R' U' R U R' U' F'" },
  { id: "OLL 49", name: "Petit L", alg: "r U' r2 U r2 U r2 U' r" },
  { id: "OLL 50", name: "Petit L", alg: "r' U r2 U' r2 U' r2 U r'" },
  { id: "OLL 53", name: "Petit L", alg: "r' U' R U' R' U R U' R' U2 r" },
  { id: "OLL 54", name: "Petit L", alg: "r U R' U R U' R' U R U2 r'" },
  // OCLL (croix orientée)
  { id: "OLL 21", name: "H", alg: "R U2 R' U' R U R' U' R U' R'" },
  { id: "OLL 22", name: "Pi", alg: "R U2 R2 U' R2 U' R2 U2 R" },
  { id: "OLL 23", name: "Headlights", alg: "R2 D' R U2 R' D R U2 R" },
  { id: "OLL 24", name: "Chameleon", alg: "r U R' U' r' F R F'" },
  { id: "OLL 25", name: "Bowtie", alg: "F' r U R' U' r' F R" },
  { id: "OLL 26", name: "Anti-Sune", alg: "R U2 R' U' R U' R'" },
  { id: "OLL 27", name: "Sune", alg: "R U R' U R U2 R'" },
];

export const PLL_CASES: CaseDef[] = [
  { id: "Aa", name: "Aa", alg: "x R' U R' D2 R U' R' D2 R2 x'" },
  { id: "Ab", name: "Ab", alg: "x R2 D2 R U R' D2 R U' R x'" },
  { id: "E", name: "E", alg: "x' R U' R' D R U R' D' R U R' D R U' R' D' x" },
  { id: "F", name: "F", alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R" },
  { id: "Ga", name: "Ga", alg: "R2 U R' U R' U' R U' R2 U' D R' U R D'" },
  { id: "Gb", name: "Gb", alg: "R' U' R U D' R2 U R' U R U' R U' R2 D" },
  { id: "Gc", name: "Gc", alg: "R2 U' R U' R U R' U R2 U D' R U' R' D" },
  { id: "Gd", name: "Gd", alg: "R U R' U' D R2 U' R U' R' U R' U R2 D'" },
  { id: "H", name: "H", alg: "M2 U M2 U2 M2 U M2" },
  { id: "Ja", name: "Ja", alg: "R' U L' U2 R U' R' U2 R L" },
  { id: "Jb", name: "Jb", alg: "R U R' F' R U R' U' R' F R2 U' R'" },
  { id: "Na", name: "Na", alg: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'" },
  { id: "Nb", name: "Nb", alg: "R' U R U' R' F' U' F R U R' F R' F' R U' R" },
  { id: "Ra", name: "Ra", alg: "R U' R' U' R U R D R' U' R D' R' U2 R'" },
  { id: "Rb", name: "Rb", alg: "R2 F R U R U' R' F' R U2 R' U2 R" },
  { id: "T", name: "T", alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
  { id: "Ua", name: "Ua", alg: "M2 U M U2 M' U M2" },
  { id: "Ub", name: "Ub", alg: "M2 U' M U2 M' U' M2" },
  { id: "V", name: "V", alg: "R' U R' U' y R' F' R2 U' R' U R' F R F" },
  { id: "Y", name: "Y", alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'" },
  { id: "Z", name: "Z", alg: "M' U M2 U M2 U M' U2 M2" },
];

export function caseKind(c: CaseDef): CaseKind {
  return EO_CASES.includes(c) ? "eo" : OLL_CASES.includes(c) ? "oll" : "pll";
}

/**
 * État résolu par `alg` : cube résolu + algo inversé, tenu comme au début de l'algo.
 * Les couleurs peuvent être décalées (rotations, r, M…) mais toutes les vérifications
 * comparent aux centres, donc ça ne gêne pas.
 */
export function caseState(alg: string): string {
  return applyAlg(SOLVED, invertAlg(alg));
}

// --- Signatures -------------------------------------------------------------
// Les fonctions ci-dessous supposent la dernière couche en haut (face U).

/** Autocollants de la dernière couche : face U puis rangées du haut de F, R, B, L (sens cohérent). */
const U_FACE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const RING = [18, 19, 20, 9, 10, 11, 45, 46, 47, 36, 37, 38]; // F, R, B, L (gauche → droite)
const SIDE_CENTERS = [22, 13, 49, 40]; // centres F, R, B, L

function rotations(facelets: string): string[] {
  const out = [facelets];
  for (let k = 1; k < 4; k++) out.push(applyAlg(out[k - 1], "y"));
  return out;
}

/** Signature OLL : quels autocollants de la dernière couche ont la couleur de U (min sur les 4 rotations y). */
export function ollSignature(facelets: string): string {
  return rotations(facelets)
    .map((f) => {
      const top = f[4];
      return [...U_FACE, ...RING].map((i) => (f[i] === top ? "1" : "0")).join("");
    })
    .sort()[0];
}

/**
 * Signature PLL : couleurs des 12 autocollants latéraux de la dernière couche, codées
 * par rapport à l'ordre des centres (F R B L) puis décalées pour commencer à 0,
 * minimum sur les 4 rotations. Invariant par AUF avant/après et par rotation y.
 */
export function pllSignature(facelets: string): string {
  return rotations(facelets)
    .map((f) => {
      const order = SIDE_CENTERS.map((i) => f[i]);
      const codes = RING.map((i) => order.indexOf(f[i]));
      return codes.map((c) => (c - codes[0] + 4) % 4).join("");
    })
    .sort()[0];
}

// Arêtes de la dernière couche : case de U et autocollant latéral (B, L, R, F).
const EDGE_STICKERS = [1, 46, 3, 37, 5, 10, 7, 19];

/** Signature de la croix : quels autocollants d'arêtes ont la couleur de U (min sur les 4 rotations y). */
export function eoSignature(facelets: string): string {
  return rotations(facelets)
    .map((f) => EDGE_STICKERS.map((i) => (f[i] === f[4] ? "1" : "0")).join(""))
    .sort()[0];
}

/** Arêtes de la dernière couche orientées (croix de la couleur de U). */
export function edgesOriented(facelets: string): boolean {
  return [1, 3, 5, 7].every((i) => facelets[i] === facelets[4]);
}

/** Dernière couche orientée (face U d'une seule couleur). */
export function isOriented(facelets: string): boolean {
  return U_FACE.every((i) => facelets[i] === facelets[4]);
}

const SOLVED_PLL_SIGNATURE = pllSignature(SOLVED);

function buildTable(cases: CaseDef[], signature: (f: string) => string): Map<string, CaseDef> {
  const table = new Map<string, CaseDef>();
  for (const c of cases) table.set(signature(caseState(c.alg)), c);
  return table;
}

let eoTable: Map<string, CaseDef> | null = null;
let ollTable: Map<string, CaseDef> | null = null;
let pllTable: Map<string, CaseDef> | null = null;

/** Cas de croix de l'état (dernière couche en haut, F2L faits). "skip" si la croix est faite, null si inconnu. */
export function recognizeEo(facelets: string): CaseDef | "skip" | null {
  if (edgesOriented(facelets)) return "skip";
  eoTable ??= buildTable(EO_CASES, eoSignature);
  return eoTable.get(eoSignature(facelets)) ?? null;
}

/** L'état (dernière couche en haut) présente-t-il le cas c ? (F2L non vérifiés) */
export function showsCaseState(facelets: string, c: CaseDef): boolean {
  const kind = caseKind(c);
  if (kind === "eo") return recognizeEo(facelets) === c;
  if (kind === "oll") return recognizeOll(facelets) === c;
  return isOriented(facelets) && recognizePll(facelets) === c;
}

/** Cas OLL de l'état (dernière couche en haut, F2L faits). "skip" si déjà orienté, null si inconnu. */
export function recognizeOll(facelets: string): CaseDef | "skip" | null {
  if (isOriented(facelets)) return "skip";
  ollTable ??= buildTable(OLL_CASES, ollSignature);
  return ollTable.get(ollSignature(facelets)) ?? null;
}

/** Cas PLL de l'état (dernière couche en haut et orientée). "skip" si résolu à un AUF près, null si inconnu. */
export function recognizePll(facelets: string): CaseDef | "skip" | null {
  const sig = pllSignature(facelets);
  if (sig === SOLVED_PLL_SIGNATURE) return "skip";
  pllTable ??= buildTable(PLL_CASES, pllSignature);
  return pllTable.get(sig) ?? null;
}

// --- Vérification d'un algo saisi ----------------------------------------

export type AlgCheck = { ok: true; alg: string } | { ok: false; error: string };

/**
 * Vérifie qu'un algo résout le cas `c` (à un AUF près avant et après, rotations
 * et mouvements larges acceptés) sans casser les F2L. Renvoie l'algo normalisé
 * (espaces uniformes, Rw → r).
 */
export function checkCaseAlg(c: CaseDef, alg: string): AlgCheck {
  let normalized: string;
  try {
    const moves = parseAnyAlg(alg);
    if (moves.length === 0) return { ok: false, error: "Algo vide." };
    normalized = alg.replace(/[()]/g, " ").split(/\s+/).filter(Boolean).join(" ").replace(/([URFDLB])w/g, (_, f: string) => f.toLowerCase());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const state = caseState(normalized);
  if (!allSolved(state, CROSS_GROUPS.D.f2l)) return { ok: false, error: "Cet algo casse les deux premières couches." };
  const kind = caseKind(c);
  const found = kind === "eo" ? recognizeEo(state) : kind === "oll" ? recognizeOll(state) : isOriented(state) ? recognizePll(state) : null;
  if (found === c) return { ok: true, alg: normalized };
  if (found === "skip") {
    return { ok: false, error: kind === "eo" ? "Cet algo ne change pas l'orientation des arêtes." : "Cet algo ne change pas la dernière couche (à un AUF près)." };
  }
  if (found) {
    const what = kind === "eo" ? `la croix « ${found.name} »` : kind === "oll" ? found.id : `la ${found.id}-perm`;
    return { ok: false, error: `Cet algo résout ${what}, pas ce cas.` };
  }
  const none = { eo: "Cet algo ne fait pas la croix.", oll: "Cet algo ne résout aucune OLL.", pll: "Cet algo ne résout pas une PLL (il dérange l'orientation ?)." };
  return { ok: false, error: none[kind] };
}
