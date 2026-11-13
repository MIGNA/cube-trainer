// Exercice « Toutes mes PLL » : le joueur enchaîne ses PLL dans l'ordre qu'il veut, autant
// de fois qu'il veut. Avec le cube connecté, chaque formule est reconnue par son effet sur le cube (pas par les lettres) : n'importe
// quel AUF avant/après, n'importe quelle tenue, n'importe quelle formule. Les mouvements
// en trop par rapport à la formule du joueur = erreurs.
// Logique pure ; l'affichage est dans ui/pll-run.ts.

import { PLL_CASES } from "../cube/cases";
import { applyAlg } from "../cube/facelets";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { holdingRotation } from "./warmup";

/** Permutation des 54 facelets : état suivant[i] = état précédent[perm[i]]. */
type Perm = number[];

// Un caractère différent par facelet : appliquer des mouvements donne la permutation.
const LABELS = Array.from({ length: 54 }, (_, i) => String.fromCharCode(0x100 + i)).join("");
const permOf = (moves: readonly string[]): Perm => [...applyAlg(LABELS, moves.join(" "))].map((c) => c.charCodeAt(0) - 0x100);
const applyPerm = (state: string, perm: Perm): string => perm.map((j) => state[j]).join("");

/** En dessous, une suite de mouvements ne peut pas faire une PLL (évite les faux positifs). */
const MIN_MOVES = 6;

interface Variant {
  id: string;
  perm: Perm;
  /** Quarts de tour d'AUF compris dans cette variante (pas des erreurs). */
  auf: number;
}

export interface PllDone {
  id: string;
  /** Quarts de tour reçus depuis la PLL précédente. */
  moves: number;
  /** Mouvements en trop par rapport à la formule du joueur (AUF non comptés). */
  extra: number;
}

/**
 * Effets possibles de chaque PLL sur le cube (repère cube), AUF avant et après compris,
 * quelle que soit la face du haut (la tenue n'a pas à être réglée pour cet exercice).
 */
function pllVariants(): Variant[] {
  const seen = new Set<string>();
  const out: Variant[] = [];
  const aufQuarters = [0, 1, 2, 1];
  for (const up of ["U", "D", "F", "B", "R", "L"] as const) {
    const front = up === "F" || up === "B" ? "U" : "F";
    const rotation = holdingRotation({ up, front });
    const toCube = (alg: string) => physicalQuarters(`${rotation} ${alg}`).map(switchFrame);
    const auf = toCube("U")[0]; // la face du haut, telle que le cube la voit
    for (const c of PLL_CASES) {
      const core = toCube(c.alg);
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          const perm = permOf([...Array(a).fill(auf), ...core, ...Array(b).fill(auf)]);
          const key = perm.join(",");
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ id: c.id, perm, auf: aufQuarters[a] + aufQuarters[b] });
        }
      }
    }
  }
  return out;
}

let cachedVariants: Variant[] | null = null;

/** Quarts de tour vus par le cube pour une formule (rotations = 0). */
export const quarterCount = (alg: string) => physicalQuarters(alg).length;

/** Ce qu'un mouvement a déclenché : une PLL reconnue, ou le retour à l'état d'avant (tentative ratée défaite). */
export type PllRunEvent = { kind: "pll"; done: PllDone } | { kind: "back" };

/**
 * Chaque formule est reconnue par son effet sur le cube depuis la PLL précédente. Après
 * une erreur, le joueur peut revenir à l'état d'avant la PLL : la reconnaissance repart
 * de là, et les mouvements de la tentative ratée comptent comme erreurs de la PLL
 * reconnue ensuite (en général celle qu'il retente).
 */
export class PllRunTracker {
  private readonly variants: Variant[];
  /** État après la dernière PLL reconnue (ou le départ). */
  private checkpoint: string;
  /** Quarts de tour reçus depuis (tentative en cours). */
  since = 0;
  /** Mouvements des tentatives ratées puis défaites, depuis la dernière PLL. */
  wasted = 0;
  readonly done: PllDone[] = [];

  /**
   * @param algs formule du joueur par PLL (pour compter les mouvements en trop) ; les PLL
   *   absentes sont reconnues quand même, comparées à la formule standard.
   */
  constructor(
    private readonly algs: Readonly<Record<string, string>>,
    start: string,
  ) {
    this.variants = cachedVariants ??= pllVariants();
    this.checkpoint = start;
  }

  /** À appeler après chaque quart de tour reçu (état du cube, repère cube). */
  move(state: string): PllRunEvent | null {
    this.since++;
    return this.check(state);
  }

  /** État renvoyé par le cube sans mouvement (modèle recalé) : on revérifie. */
  observe(state: string): PllRunEvent | null {
    return this.since > 0 ? this.check(state) : null;
  }

  private check(state: string): PllRunEvent | null {
    if (state === this.checkpoint) {
      // Revenu à l'état d'avant : la tentative est défaite, on repart de zéro.
      this.wasted += this.since;
      this.since = 0;
      return { kind: "back" };
    }
    if (this.since < MIN_MOVES) return null;
    const v = this.variants.find((x) => applyPerm(this.checkpoint, x.perm) === state);
    if (!v) return null;
    const alg = this.algs[v.id] ?? PLL_CASES.find((c) => c.id === v.id)!.alg;
    const done = { id: v.id, moves: this.since + this.wasted, extra: Math.max(0, this.since - v.auf - quarterCount(alg)) + this.wasted };
    this.done.push(done);
    this.checkpoint = state;
    this.since = 0;
    this.wasted = 0;
    return { kind: "pll", done };
  }

  /** Repartir de l'état actuel (après s'être emmêlé sans pouvoir revenir) : la tentative en cours est oubliée. */
  restart(state: string): void {
    this.checkpoint = state;
    this.since = 0;
    this.wasted = 0;
  }
}

export interface PllStat {
  id: string;
  count: number;
  /** Passages sans mouvement en trop. */
  clean: number;
  /** Passages avec au moins un mouvement en trop (une grosse erreur ne pèse pas plus qu'une petite). */
  withErrors: number;
  /** Mouvements en trop au total (cube connecté). */
  extra: number;
  moves: number;
}

/** Bilan par PLL : les plus souvent ratées d'abord. */
export function pllStats(done: readonly PllDone[]): PllStat[] {
  const by = new Map<string, PllStat>();
  for (const d of done) {
    const s = by.get(d.id) ?? { id: d.id, count: 0, clean: 0, withErrors: 0, extra: 0, moves: 0 };
    s.count++;
    if (d.extra > 0) s.withErrors++;
    else s.clean++;
    s.extra += d.extra;
    s.moves += d.moves;
    by.set(d.id, s);
  }
  return [...by.values()].sort((a, b) => b.withErrors / b.count - a.withErrors / a.count || b.withErrors - a.withErrors || b.count - a.count);
}
