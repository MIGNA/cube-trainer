// Exercice « Toutes mes PLL » : le joueur enchaîne ses PLL dans l'ordre qu'il veut, autant
// de fois qu'il veut. Avec le cube connecté, chaque formule est reconnue par son effet sur le cube (pas par les lettres) : n'importe
// quel AUF avant/après, n'importe quelle tenue, n'importe quelle formule. Les mouvements
// en trop par rapport à la formule du joueur = erreurs ; ce qui ramène le cube au point de
// départ (hésitation, tremblement, faux départ défait) n'en est pas une.
// Logique pure ; l'affichage est dans ui/pll-run.ts.

import { suggestedAlgs } from "../cube/case-algs";
import { PLL_CASES, checkCaseAlg, type CaseDef } from "../cube/cases";
import { applyAlg } from "../cube/facelets";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { DEFAULT_HOLDING, HOLDINGS, holdingRotation, playerMove, type Holding } from "./warmup";

/** Permutation des 54 facelets : état suivant[i] = état précédent[perm[i]]. */
type Perm = number[];

// Un caractère différent par facelet : appliquer des mouvements donne la permutation.
const LABELS = Array.from({ length: 54 }, (_, i) => String.fromCharCode(0x100 + i)).join("");
const permOf = (moves: readonly string[]): Perm => [...applyAlg(LABELS, moves.join(" "))].map((c) => c.charCodeAt(0) - 0x100);
const applyPerm = (state: string, perm: Perm): string => perm.map((j) => state[j]).join("");

/** À partir de ce nombre de mouvements, une tentative défaite est affichée (« Faux départ »). */
export const FALSE_START_MIN = 4;

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
  /** Formule reconnue : celle du joueur ou une autre formule connue du cas, la plus proche de ce qui a été fait. */
  expected?: string;
  /**
   * Formule inconnue (ni à moi, ni suggérée) : ce qui a été fait, AUF de début et de fin
   * retirés, écrit jaune en haut. Compté en erreur (amener le bon état ne suffit pas) ;
   * refait à l'identique, l'appli propose de l'enregistrer.
   */
  other?: string;
  /** Mouvements faits, tels que le joueur tient le cube (quarts de tour regroupés). */
  played?: string;
  /** Mouvements faits comparés à la formule (erreurs repérées), voir `markPlayed`. */
  marks?: PlayedMove[];
  /** Faux départs défaits avant (FALSE_START_MIN mouvements ou plus), pour info : pas des erreurs. */
  falseStart?: string;
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
  /** Faux départs défaits depuis la dernière PLL (repère cube), pour l'affichage seulement. */
  private falseStarts: string[][] = [];
  readonly done: PllDone[] = [];
  /** Rotation de la tenue du joueur : gestes et affichage des mouvements faits. */
  private readonly rotation: string;
  /** Faces du haut, du bas et de droite (repère cube) d'après la tenue, pour les gestes U4 / D4 / R4. */
  private readonly up: string;
  /** Formules du joueur par PLL (la première = celle entraînée). */
  private readonly algs = new Map<string, string[]>();
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
    algs: Readonly<Record<string, string | readonly string[]>>,
    start: string,
    holding: Holding = DEFAULT_HOLDING,
  ) {
    for (const [id, list] of Object.entries(algs)) this.algs.set(id, typeof list === "string" ? [list] : [...list]);
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
  private toPlayer(moves: readonly string[], rotation = this.rotation): string {
    const player = moves.map((m) => playerMove(m, rotation));
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
      // Revenu à l'état d'avant : la tentative est défaite, on repart de zéro, sans erreur
      // (un aller-retour B B' n'en est pas une). Les longs faux départs sont gardés pour info.
      if (this.attempt.length >= FALSE_START_MIN) this.falseStarts.push(this.attempt);
      this.attempt = [];
      this.startedAt = null;
      return { kind: "back" };
    }
    if (this.since < MIN_MOVES) return null;
    const v = this.variants.find((x) => applyPerm(this.checkpoint, x.perm) === state);
    if (!v) return null;
    // N'importe quelle formule connue du cas convient (une PLL peut se faire dans un sens
    // ou dans l'autre) : on compare à la plus proche de ce qui a été fait.
    const c = PLL_CASES.find((x) => x.id === v.id)!;
    const mine = this.algs.get(v.id) ?? [];
    const candidates = [...new Set([...mine, ...suggestedAlgs(c)])];
    // Ressemblance mesurée sur les mouvements simplifiés (erreurs défaites retirées) : faire
    // plus de mouvements ne doit pas rendre une autre formule plus « ressemblante ».
    const simple = simplifyQuarters(this.attempt);
    const scored = candidates.map((alg) => {
      const s = alignPlayed(alg, simple);
      const full = alignPlayed(alg, this.attempt);
      return {
        alg,
        marks: full.marks,
        ratio: s.matched / (s.total + s.extras),
        // Erreurs = mouvements hors formule, sauf les AUF du début et de la fin (même
        // hésitants : U2 U' avant la formule n'est pas une erreur).
        extra: full.extras,
      };
    });
    const best = scored.reduce((x, y) => (y.ratio > x.ratio || (y.ratio === x.ratio && y.extra < x.extra) ? y : x));
    // Formule trop peu retrouvée : c'est une autre formule, pas des erreurs.
    const unknown = best.ratio < SAME_ALG_MIN;
    const done: PllDone = {
      id: v.id,
      moves: this.since,
      // Formule inconnue = erreur : au moins 1, sinon l'écart de longueur avec la mienne.
      extra: unknown ? Math.max(1, this.since - v.auf - quarterCount(mine[0] ?? c.alg)) : best.extra,
      expected: unknown ? (mine[0] ?? c.alg) : best.alg,
      played: this.toPlayer(this.attempt),
      ...(unknown ? { other: this.otherFormula(c) } : { marks: best.marks }),
      ...(this.falseStarts.length ? { falseStart: this.falseStarts.map((a) => this.toPlayer(a)).join(" / ") } : {}),
      ...(now !== null && this.startedAt !== null ? { timeMs: now - this.startedAt } : {}),
    };
    this.done.push(done);
    this.checkpoint = state;
    this.attempt = [];
    this.startedAt = null;
    this.falseStarts = [];
    this.run = { move: "", count: 0 };
    return { kind: "pll", done };
  }

  /** Ajoute une formule à une PLL (enregistrée pendant l'exercice) ; `main` = devient celle entraînée. */
  addAlg(id: string, alg: string, main: boolean): void {
    const list = (this.algs.get(id) ?? []).filter((a) => a !== alg);
    this.algs.set(id, main ? [alg, ...list] : [...list, alg]);
  }

  /**
   * Tentative en cours écrite comme une formule du cas (jaune en haut, AUF de début et de fin
   * retirés) : la tenue réglée d'abord, sinon la première tenue où elle résout bien le cas.
   */
  private otherFormula(c: CaseDef): string {
    for (const rotation of [this.rotation, ...HOLDINGS]) {
      const up = switchFrame(physicalQuarters(`${rotation} U`)[0])[0];
      let a = 0;
      let b = this.attempt.length;
      while (a < b && this.attempt[a][0] === up) a++;
      while (b > a && this.attempt[b - 1][0] === up) b--;
      const check = checkCaseAlg(c, this.toPlayer(this.attempt.slice(a, b), rotation));
      if (check.ok) return check.alg;
    }
    return this.toPlayer(this.attempt);
  }

  /** Repartir de l'état actuel (après s'être emmêlé sans pouvoir revenir) : la tentative en cours est oubliée. */
  restart(state: string): void {
    this.checkpoint = state;
    this.attempt = [];
    this.startedAt = null;
    this.falseStarts = [];
    this.run = { move: "", count: 0 };
  }
}

/** Un mouvement fait, comparé à la formule : juste, AUF (avant / après), ou en trop. */
export interface PlayedMove {
  text: string;
  kind: "ok" | "auf" | "extra";
}

const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const FACE_RANK = "UDRLFB";

/**
 * Tours de faces opposées consécutifs mis dans un ordre fixe (M2 = R2 L2 ou L2 R2 : même
 * effet), pour que l'ordre choisi par le joueur ne compte pas comme une erreur.
 */
function sortAxisRuns<T extends { move: string }>(list: T[]): T[] {
  const out: T[] = [];
  let run: T[] = [];
  const flush = () => {
    out.push(...run.sort((a, b) => FACE_RANK.indexOf(a.move[0]) - FACE_RANK.indexOf(b.move[0])));
    run = [];
  };
  for (const x of list) {
    if (run.length && AXIS[run[0].move[0]] !== AXIS[x.move[0]]) flush();
    run.push(x);
  }
  flush();
  return out;
}

/**
 * Compare les quarts de tour reçus (repère cube) à la formule du joueur et repère les
 * erreurs. La tenue n'est pas connue : on essaie les 24 façons de tenir le cube et on
 * garde celle qui colle le mieux (un F fait en tenant le cube tourné n'est pas une erreur).
 * Résultat écrit comme la formule : mouvements justes regroupés comme dans la formule
 * (U' U' pour un U2 → « U2 »), les autres en lettres du joueur (R R → R2).
 */
export function markPlayed(alg: string, attempt: readonly string[]): PlayedMove[] {
  return alignPlayed(alg, attempt).marks;
}

/**
 * Part de la formule à retrouver dans ce qui a été fait pour dire que c'est cette formule :
 * mesurée sur les mouvements simplifiés, une formule bien faite ou dont les erreurs ont été
 * défaites ressort à 100 %, deux formules différentes d'une même PLL à 82 % au plus.
 */
export const SAME_ALG_MIN = 0.9;

/** `markPlayed` + nombre de quarts de tour de la formule retrouvés (`matched` sur `total`). */
export function alignPlayed(
  alg: string,
  attempt: readonly string[],
): { marks: PlayedMove[]; matched: number; total: number; extras: number } {
  // Formule : jeton écrit de chaque quart de tour (un demi-tour = 2 quarts du même jeton).
  const tokens = alg.split(/\s+/).map((t) => t.replace(/[()]/g, "")).filter(Boolean);
  const tokenOf: number[] = [];
  let before = 0;
  tokens.forEach((_, i) => {
    const n = physicalQuarters(tokens.slice(0, i + 1).join(" ")).length;
    for (let k = before; k < n; k++) tokenOf.push(i);
    before = n;
  });
  const actual = sortAxisRuns(attempt.map((move) => ({ move })));

  let best: { matched: (number | null)[]; rotation: string; aufFace: string; score: number; count: number; extras: number } | null = null;
  for (const rotation of HOLDINGS) {
    const raw = physicalQuarters(`${rotation} ${alg}`).map(switchFrame);
    // Demi-tour (R2, M2…) : deux quarts de tour de la même face dans le même jeton, sens libre.
    const exp = sortAxisRuns(
      raw.map((move, k) => ({
        move,
        token: tokenOf[k],
        half: raw.filter((x, l) => tokenOf[l] === tokenOf[k] && x[0] === move[0]).length === 2,
      })),
    );
    const same = (a: string, e: (typeof exp)[number]) => a === e.move || (e.half && a[0] === e.move[0]);
    // Plus longue sous-suite commune (alignement des mouvements faits sur la formule).
    const n = actual.length;
    const m = exp.length;
    const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        dp[i][j] = same(actual[i].move, exp[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const matched: (number | null)[] = new Array(n).fill(null);
    for (let i = 0, j = 0; i < n && j < m; ) {
      if (same(actual[i].move, exp[j]) && dp[i][j] === dp[i + 1][j + 1] + 1) matched[i++] = exp[j++].token;
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    const aufFace = switchFrame(physicalQuarters(`${rotation} U`)[0])[0];
    const first = matched.findIndex((t) => t !== null);
    const last = matched.length - 1 - [...matched].reverse().findIndex((t) => t !== null);
    const extras = matched.filter((t, i) => t === null && !((i < first || i > last || first < 0) && actual[i].move[0] === aufFace)).length;
    const score = dp[0][0] * 100 - extras;
    if (!best || score > best.score) best = { matched, rotation, aufFace, score, count: dp[0][0], extras };
  }
  if (!best) return { marks: [], matched: 0, total: 1, extras: 0 };

  const { matched, rotation, aufFace } = best;
  const first = matched.findIndex((t) => t !== null);
  const last = matched.length - 1 - [...matched].reverse().findIndex((t) => t !== null);
  const out: PlayedMove[] = [];
  for (let i = 0; i < actual.length; i++) {
    const t = matched[i];
    if (t !== null) {
      // Les quarts de tour d'un même jeton de la formule → le jeton tel qu'il est écrit.
      // Jeton fait en entier d'affilée (R, U2, M2…) → écrit comme dans la formule.
      const size = tokenOf.filter((x) => x === t).length;
      let run = 1;
      while (run < size && matched[i + run] === t) run++;
      if (run === size) {
        out.push({ text: tokens[t], kind: "ok" });
        i += size - 1;
      } else out.push({ text: playerMove(actual[i].move, rotation), kind: "ok" });
      continue;
    }
    const outside = first < 0 || i < first || i > last;
    const kind = outside && actual[i].move[0] === aufFace ? "auf" : "extra";
    const text = playerMove(actual[i].move, rotation);
    const prev = out.at(-1);
    // Deux quarts de tour identiques d'affilée de même nature → demi-tour.
    if (prev && prev.kind === kind && prev.text === text && matched[i - 1] === null) {
      prev.text = `${text[0]}2`;
    } else out.push({ text, kind });
  }
  return { marks: out, matched: best.count, total: Math.max(1, tokenOf.length), extras: best.extras };
}

/**
 * Quarts de tour simplifiés : tours successifs d'une même face additionnés (R R R → R',
 * R R' → rien), y compris par-dessus la face opposée ; un aller-retour imbriqué
 * (R U R' R U' R') disparaît en entier.
 */
export function simplifyQuarters(moves: readonly string[]): string[] {
  const OPP: Record<string, string> = { U: "D", D: "U", R: "L", L: "R", F: "B", B: "F" };
  const stack: { face: string; amount: number }[] = [];
  for (const m of moves) {
    const face = m[0];
    const amount = m.endsWith("'") ? 3 : 1;
    let k = stack.length - 1;
    if (k >= 0 && stack[k].face !== face && stack[k].face === OPP[face]) k--; // par-dessus la face opposée
    if (k >= 0 && stack[k].face === face) {
      stack[k].amount = (stack[k].amount + amount) % 4;
      if (stack[k].amount === 0) stack.splice(k, 1);
    } else stack.push({ face, amount });
  }
  return stack.flatMap(({ face, amount }) => (amount === 1 ? [face] : amount === 3 ? [`${face}'`] : [face, face]));
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

/** En dessous de ce nombre de passages, le pourcentage de réussite ne veut pas dire grand-chose. */
export const MIN_PASSES_FOR_RATE = 3;

/**
 * Réussite d'une PLL : part des passages sans erreur (0 à 1) et sa couleur :
 * ≥ 90 % bien, 70–89 % moyen, < 70 % à revoir ; « few » = trop peu de passages pour juger.
 */
export function successRate(s: Pick<PllStat, "clean" | "count">): { rate: number; tone: "ok" | "warn" | "bad" | "few" } {
  const rate = s.count ? s.clean / s.count : 0;
  const tone = s.count < MIN_PASSES_FOR_RATE ? "few" : rate >= 0.9 ? "ok" : rate >= 0.7 ? "warn" : "bad";
  return { rate, tone };
}

/** Une erreur du bilan, avec le nombre de fois où elle a été faite. */
export interface ErrorGroup {
  id: string;
  count: number;
  /** Formule où l'erreur a été faite. */
  expected: string;
  /**
   * Formule avec seulement cette erreur en « extra » (AUF retirés) ; absent pour une autre
   * formule (`other`) ou une erreur qu'on ne sait pas situer.
   */
  marks?: PlayedMove[];
  other?: string;
}

/**
 * Erreurs d'une séance regroupées : même PLL, même endroit de la formule, mêmes mouvements
 * en trop (un passage peut contenir plusieurs erreurs) ; « autre formule » = une erreur par
 * PLL. `frequent` = faites au moins 2 fois (les plus fréquentes d'abord), `isolated` = le reste.
 */
export function groupErrors(done: readonly PllDone[]): { frequent: ErrorGroup[]; isolated: ErrorGroup[] } {
  const groups = new Map<string, ErrorGroup>();
  const add = (key: string, g: Omit<ErrorGroup, "count">) => {
    const prev = groups.get(key);
    if (prev) prev.count++;
    else groups.set(key, { ...g, count: 1 });
  };
  for (const d of done) {
    if (d.extra <= 0) continue;
    const expected = d.expected ?? "";
    if (d.other) {
      add(`${d.id}|autre`, { id: d.id, expected, other: d.other });
      continue;
    }
    const marks = (d.marks ?? []).filter((m) => m.kind !== "auf");
    let found = false;
    for (let i = 0; i < marks.length; i++) {
      if (marks[i].kind !== "extra" || marks[i - 1]?.kind === "extra") continue;
      let j = i;
      while (j < marks.length && marks[j].kind === "extra") j++;
      found = true;
      // Endroit = nombre de mouvements justes avant ; seule cette erreur reste marquée.
      const before = marks.slice(0, i).filter((m) => m.kind === "ok").length;
      const run = marks.slice(i, j).map((m) => m.text).join(" ");
      add(`${d.id}|${before}|${run}`, {
        id: d.id,
        expected,
        marks: marks.filter((m, k) => m.kind === "ok" || (k >= i && k < j)),
      });
    }
    // Mouvements en trop qu'on ne sait pas situer (formule plus longue que la mienne…).
    if (!found) add(`${d.id}|?`, { id: d.id, expected });
  }
  const all = [...groups.values()].sort((x, y) => y.count - x.count);
  return { frequent: all.filter((g) => g.count >= 2), isolated: all.filter((g) => g.count < 2) };
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
