// Algos alternatifs proposés pour chaque cas, en plus de l'algo standard de cases.ts
// (qui est toujours la première suggestion). Les tests vérifient que chacun résout
// bien son cas sans casser les F2L.

import { EO_CASES, OLL_CASES, PLL_CASES, type CaseDef } from "./cases";

const ALTERNATIVES: Record<string, string[]> = {
  // PLL
  Aa: ["x L2 D2 L' U' L D2 L' U L' x'", "R' F R' B2 R F' R' B2 R2"],
  Ab: ["x' L2 D2 L U L' D2 L U' L x", "R B' R F2 R' B R F2 R2"],
  E: ["x' L' U L D' L' U' L D L' U' L D' L' U L D x"],
  Ga: ["R2 u R' U R' U' R u' R2 y' R' U R"],
  Gb: ["R' U' R y R2 u R' U R U' R u' R2"],
  Gc: ["R2 u' R U' R U R' u R2 y R U' R'"],
  Gd: ["R U R' y' R2 u' R U' R' U R' u R2"],
  H: ["M2 U' M2 U2 M2 U' M2", "R2 U2 R U2 R2 U2 R2 U2 R U2 R2"],
  Ja: ["x R2 F R F' R U2 r' U r U2 x'"],
  Jb: ["R U2 R' U' R U2 L' U R' U' L"],
  Nb: ["r' D' F r U' r' F' D r2 U r' U' r' F r F'"],
  Ra: ["R U R' F' R U2 R' U2 R' F R U R U2 R'", "L U2 L' U2 L F' L' U' L U L F L2"],
  Rb: ["R' U2 R U2 R' F R U R' U' R' F' R2"],
  Ua: ["R U' R U R U R U' R' U' R2"],
  Ub: ["R2 U R U R' U' R' U' R' U R'"],
  V: ["R U' R U R' D R D' R U' D R2 U R2 D' R2"],
  Y: ["F R' F R2 U' R' U' R U R' F' R U R' U' F'"],
  Z: ["M2 U M2 U M' U2 M2 U2 M'", "R' U' R U' R U R U' R' U R U R2 U' R'"],
  // Croix (2-look)
  "Croix point": ["f R U R' U' f' U' F R U R' U' F'"],
  "Croix L": ["F U R U' R' F'"],
  // OLL
  "OLL 2": ["F R U R' U' S R U R' U' f'"],
  "OLL 3": ["r' R2 U R' U r U2 r' U M'"],
  "OLL 4": ["M U' r U2 r' U' R U' R' M'"],
  "OLL 5": ["l' U2 L U L' U l"],
  "OLL 6": ["l U2 L' U' L U' l'"],
  "OLL 8": ["l' U' L U' L' U2 l"],
  "OLL 10": ["R U R' y R' F R U' R' F' R"],
  "OLL 11": ["M R U R' U R U2 R' U M'"],
  "OLL 13": ["r U' r' U' r U r' F' U F"],
  "OLL 15": ["l' U' l L' U' L U l' U l"],
  "OLL 17": ["F R' F' R2 r' U R U' R' U' M'"],
  "OLL 19": ["r' R U R U R' U' M' R' F R F'"],
  "OLL 20": ["M U R U R' U' M2 U R U' r'"],
  "OLL 21": ["R U R' U R U' R' U R U2 R'", "F R U R' U' R U R' U' R U R' U' F'"],
  "OLL 22": ["f R U R' U' f' F R U R' U' F'"],
  "OLL 23": ["R2 D R' U2 R D' R' U2 R'"],
  "OLL 24": ["L F R' F' L' F R F'"],
  "OLL 25": ["R' F R B' R' F' R B"],
  "OLL 26": ["R' U' R U' R' U2 R", "L' U' L U' L' U2 L"],
  "OLL 27": ["L' U2 L U L' U L"],
  "OLL 28": ["r U R' U' M U R U' R'", "M' U M U2 M' U M"],
  "OLL 29": ["r2 D' r U r' D r2 U' r' U' r"],
  "OLL 30": ["r' D' r U' r' D r2 U' r' U r U r'"],
  "OLL 32": ["R U B' U' R' U R B R'"],
  "OLL 37": ["F R U' R' U' R U R' F'"],
  "OLL 42": ["R' F R F' R' F R F' R U R' U' R U R'"],
  "OLL 43": ["f' L' U' L U f"],
  "OLL 44": ["f R U R' U' f'"],
  "OLL 47": ["F' L' U' L U L' U' L U F"],
  "OLL 49": ["R B' R2 F R2 B R2 F' R"],
  "OLL 50": ["R' F R2 B' R2 F' R2 B R'"],
  "OLL 51": ["f R U R' U' R U R' U' f'"],
  "OLL 52": ["R' U' R U' R' U F' U F R"],
  "OLL 53": ["l' U2 L U L' U' L U L' U l"],
  "OLL 54": ["r U2 R' U' R U R' U' R U' r'"],
  "OLL 55": ["R U2 R2 U' R U' R' U2 F R F'"],
  "OLL 56": ["F R U R' U' R F' r U R' U' r'"],
};

export const ALL_CASES: CaseDef[] = [...PLL_CASES, ...OLL_CASES, ...EO_CASES];

/** Ensembles d'algos proposés dans l'onglet Algos. */
export type AlgSet = "cfop" | "2look" | "beginner";

/** Groupe de cas affichés ensemble (avec un intitulé pour les temps du 2-look). */
export interface CaseGroup {
  label?: string;
  /** Astuce affichée sous l'intitulé. */
  hint?: string;
  cases: CaseDef[];
}

const byIds = (list: CaseDef[], ids: string[]) => ids.map((id) => list.find((c) => c.id === id)!);

/** Cas de chaque ensemble, par bloc (OLL au sens large : croix + OLL). Débutant : pas de cas, une synthèse. */
export const SET_CASES: Record<AlgSet, { oll: CaseGroup[]; pll: CaseGroup[] }> = {
  cfop: { oll: [{ cases: OLL_CASES }], pll: [{ cases: PLL_CASES }] },
  "2look": {
    oll: [
      { label: "1er temps : la croix", cases: EO_CASES },
      { label: "2e temps : les coins", cases: byIds(OLL_CASES, ["OLL 21", "OLL 22", "OLL 23", "OLL 24", "OLL 25", "OLL 26", "OLL 27"]) },
    ],
    pll: [
      {
        label: "1er temps : les coins",
        hint: "Pas de phares (deux coins de même couleur côte à côte) ? Fais un A depuis n'importe quel angle : des phares apparaissent, puis refais un A.",
        cases: byIds(PLL_CASES, ["Aa", "Ab"]),
      },
      { label: "2e temps : les arêtes", cases: byIds(PLL_CASES, ["Ua", "Ub", "H", "Z"]) },
    ],
  },
  beginner: { oll: [], pll: [] }, // synthèse à part : cube/beginner.ts
};

export function findCase(id: string): CaseDef | undefined {
  return ALL_CASES.find((c) => c.id === id);
}

/** Algos suggérés pour un cas : l'algo standard puis les alternatives. */
export function suggestedAlgs(c: CaseDef): string[] {
  return [c.alg, ...(ALTERNATIVES[c.id] ?? [])];
}

/** Algos de l'utilisateur pour un cas (le premier est celui entraîné) ; par défaut l'algo standard. */
export function myAlgs(c: CaseDef, saved: Record<string, string[]>): string[] {
  const list = saved[c.id];
  return list && list.length > 0 ? list : [c.alg];
}

/** Algo entraîné pour un cas. */
export function mainAlg(c: CaseDef, saved: Record<string, string[]>): string {
  return myAlgs(c, saved)[0];
}

/** Liste après avoir mis `alg` en premier (ajouté s'il n'y était pas). */
export function withMain(list: string[], alg: string): string[] {
  return [alg, ...list.filter((a) => a !== alg)];
}

/** Liste sans `alg` (jamais vide : on ne retire pas le dernier). */
export function without(list: string[], alg: string): string[] {
  const rest = list.filter((a) => a !== alg);
  return rest.length > 0 ? rest : list;
}
