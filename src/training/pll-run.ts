// Exercice « Toutes mes PLL » : le joueur enchaîne ses PLL dans l'ordre qu'il veut, autant
// de fois qu'il veut. Avec le cube connecté, chaque formule est reconnue par son effet sur le cube (pas par les lettres) : n'importe
// quel AUF avant/après, n'importe quelle tenue, n'importe quelle formule. Les mouvements
// en trop par rapport à la formule du joueur = erreurs.
// Logique pure ; l'affichage est dans ui/pll-run.ts.

import { PLL_CASES } from "../cube/cases";
import { applyAlg } from "../cube/facelets";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { DEFAULT_HOLDING, holdingRotation, playerMove, type Holding } from "./warmup";

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
  /** Formule attendue (celle du joueur). */
  expected?: string;
  /** Mouvements faits, tels que le joueur tient le cube (quarts de tour regroupés). */
  played?: string;
  /** Tentatives ratées puis défaites avant (mêmes conventions). */
  failed?: string;
  /** Temps d'exécution : premier mouvement → mouvement qui termine la PLL (ms). */
  timeMs?: number;
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

/**
 * Ce qu'un mouvement a déclenché : une PLL reconnue, le retour à l'état d'avant (tentative
 * ratée défaite), ou un geste : U4 = repartir d'ici, D4 = annuler la dernière PLL reconnue,
 * R4 = terminer.
 */
export type PllRunEvent =
  | { kind: "pll"; done: PllDone }
  | { kind: "back" }
  | { kind: "reset" }
  | { kind: "undo"; done: PllDone | null }
  | { kind: "end" };

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
  /** Mouvements reçus depuis (tentative en cours, repère cube). */
  private attempt: string[] = [];
  /** Mouvements des tentatives ratées puis défaites, depuis la dernière PLL (repère cube). */
  private wastedMoves: string[] = [];
  readonly done: PllDone[] = [];
  /** Rotation de la tenue du joueur : gestes et affichage des mouvements faits. */
  private readonly rotation: string;
  /** Faces du haut, du bas et de droite (repère cube) d'après la tenue, pour les gestes U4 / D4 / R4. */
  private readonly up: string;
  private readonly down: string;
  private readonly right: string;
  /** Dernier mouvement et nombre de fois d'affilée (gestes). */
  private run = { move: "", count: 0 };
  /** Heure du premier mouvement de la tentative en cours (temps d'exécution). */
  private startedAt: number | null = null;

  /**
   * @param algs formule du joueur par PLL (pour compter les mouvements en trop) ; les PLL
   *   absentes sont reconnues quand même, comparées à la formule standard.
   * @param holding tenue du joueur : sert aux gestes (U4 / D4 / R4) et à l'affichage des
   *   mouvements faits, pas à la reconnaissance.
   */
  constructor(
    private readonly algs: Readonly<Record<string, string>>,
    start: string,
    holding: Holding = DEFAULT_HOLDING,
  ) {
    this.variants = cachedVariants ??= pllVariants();
    this.checkpoint = start;
    this.rotation = holdingRotation(holding);
    const face = (f: string) => switchFrame(physicalQuarters(`${this.rotation} ${f}`)[0]);
    this.up = face("U");
    this.down = face("D");
    this.right = face("R");
  }

  /** Quarts de tour reçus depuis la dernière PLL (tentative en cours). */
  get since(): number {
    return this.attempt.length;
  }

  /** Mouvements des tentatives ratées puis défaites (nombre). */
  get wasted(): number {
    return this.wastedMoves.length;
  }

  /**
   * À appeler après chaque quart de tour reçu : mouvement et état du cube (repère cube),
   * heure du mouvement en ms (sans heure, pas de temps d'exécution).
   */
  move(move: string, state: string, now?: number): PllRunEvent | null {
    if (this.attempt.length === 0) this.startedAt = now ?? null;
    this.attempt.push(move);
    this.run = this.run.move === move ? { move, count: this.run.count + 1 } : { move, count: 1 };
    // Geste : quatre quarts de tour d'affilée d'une même face (le cube revient où il était).
    if (this.run.count === 4) {
      const face = move[0];
      this.run = { move: "", count: 0 };
      if (face === this.up) {
        this.restart(state);
        return { kind: "reset" };
      }
      if (face === this.down || face === this.right) {
        this.attempt.splice(-4);
        if (this.attempt.length === 0) this.startedAt = null;
        return face === this.down ? { kind: "undo", done: this.done.pop() ?? null } : { kind: "end" };
      }
    }
    this.lastAt = now ?? null;
    return this.check(state, this.lastAt);
  }

  /** Heure du dernier mouvement reçu (pour un état recalé sans mouvement). */
  private lastAt: number | null = null;

  /** Annule la dernière PLL reconnue (mauvaise reconnaissance) ; la reconnaissance continue d'ici. */
  undo(): PllDone | null {
    return this.done.pop() ?? null;
  }

  /** État renvoyé par le cube sans mouvement (modèle recalé) : on revérifie. */
  observe(state: string): PllRunEvent | null {
    return this.since > 0 ? this.check(state, this.lastAt) : null;
  }

  /**
   * Mouvements (repère cube) écrits comme le joueur les voit : deux quarts de tour identiques
   * d'affilée → demi-tour (R R → R2), mais un aller-retour (F F') reste visible.
   */
  private toPlayer(moves: readonly string[]): string {
    const player = moves.map((m) => playerMove(m, this.rotation));
    const out: string[] = [];
    for (let i = 0; i < player.length; i++) {
      if (player[i] === player[i + 1]) {
        out.push(`${player[i][0]}2`);
        i++;
      } else out.push(player[i]);
    }
    return out.join(" ");
  }

  private check(state: string, now: number | null): PllRunEvent | null {
    if (state === this.checkpoint) {
      // Revenu à l'état d'avant : la tentative est défaite, on repart de zéro.
      this.wastedMoves.push(...this.attempt);
      this.attempt = [];
      this.startedAt = null;
      return { kind: "back" };
    }
    if (this.since < MIN_MOVES) return null;
    const v = this.variants.find((x) => applyPerm(this.checkpoint, x.perm) === state);
    if (!v) return null;
    const alg = this.algs[v.id] ?? PLL_CASES.find((c) => c.id === v.id)!.alg;
    const done: PllDone = {
      id: v.id,
      moves: this.since + this.wasted,
      extra: Math.max(0, this.since - v.auf - quarterCount(alg)) + this.wasted,
      expected: alg,
      played: this.toPlayer(this.attempt),
      ...(this.wasted ? { failed: this.toPlayer(this.wastedMoves) } : {}),
      ...(now !== null && this.startedAt !== null ? { timeMs: now - this.startedAt } : {}),
    };
    this.done.push(done);
    this.checkpoint = state;
    this.attempt = [];
    this.startedAt = null;
    this.wastedMoves = [];
    this.run = { move: "", count: 0 };
    return { kind: "pll", done };
  }

  /** Repartir de l'état actuel (après s'être emmêlé sans pouvoir revenir) : la tentative en cours est oubliée. */
  restart(state: string): void {
    this.checkpoint = state;
    this.attempt = [];
    this.startedAt = null;
    this.wastedMoves = [];
    this.run = { move: "", count: 0 };
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
  /** Temps d'exécution moyen des passages sans erreur (ms), null si aucun. */
  cleanTimeMs: number | null;
}

/** Bilan par PLL : les plus souvent ratées d'abord. */
export function pllStats(done: readonly PllDone[]): PllStat[] {
  const by = new Map<string, PllStat>();
  const times = new Map<string, number[]>();
  for (const d of done) {
    const s = by.get(d.id) ?? { id: d.id, count: 0, clean: 0, withErrors: 0, extra: 0, moves: 0, cleanTimeMs: null };
    s.count++;
    if (d.extra > 0) s.withErrors++;
    else {
      s.clean++;
      if (d.timeMs !== undefined) {
        const t = times.get(d.id) ?? [];
        t.push(d.timeMs);
        times.set(d.id, t);
        s.cleanTimeMs = t.reduce((a, b) => a + b, 0) / t.length;
      }
    }
    s.extra += d.extra;
    s.moves += d.moves;
    by.set(d.id, s);
  }
  return [...by.values()].sort((a, b) => b.withErrors / b.count - a.withErrors / a.count || b.withErrors - a.withErrors || b.count - a.count);
}
