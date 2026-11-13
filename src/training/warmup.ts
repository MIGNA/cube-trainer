// Échauffement : enchaînements de triggers et de PLL connues.
// Chaque exercice est répété jusqu'à ce que le cube revienne à son point de départ
// (sexy move ×6, T-perm ×2…) : pas besoin de mélanger, et le cube vérifie tout seul.
// Logique pure (tirage, répétitions, suivi) ; l'affichage est dans ui/views/training.ts.

import { OPPOSITE, SOLVED, allSolved, applyAlg, type Face } from "../cube/facelets";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { TRIGGERS, mirrorAlg } from "../cube/triggers";

export interface WarmupExercise {
  kind: "trigger" | "pll";
  label: string;
  /** Formule d'une répétition (repère joueur), telle que dans les Algos. */
  alg: string;
  /**
   * Ajouté en fin de répétition (affiché à part) : rotation pour reprendre le cube dans
   * la tenue de départ (V-perm avec y → y'), et AUF si sans lui le cube ne revient pas
   * au départ en 6 répétitions.
   */
  extra?: string;
  reps: number;
  /** Trigger en version main gauche. */
  left?: boolean;
}

const ALL = [...Array(54).keys()];
const MAX_REPS = 6;

/** Résolu à une rotation près (comparaison aux centres). */
const solvedState = (s: string) => allSolved(s, ALL);

const repeat = (alg: string, n: number) => Array(n).fill(alg).join(" ");

/** Formule complète d'une répétition (avec le retour à la tenue de départ / l'AUF). */
export const repetitionAlg = (ex: { alg: string; extra?: string }) => (ex.extra ? `${ex.alg} ${ex.extra}` : ex.alg);

/** Nombre de répétitions qui ramènent le cube au départ (null si plus de 6). */
export function cycleLength(alg: string): number | null {
  let s = SOLVED;
  for (let n = 1; n <= MAX_REPS; n++) {
    s = applyAlg(s, alg);
    if (solvedState(s)) return n;
  }
  return null;
}

/** Centres, pour savoir si une formule laisse le cube tourné (rotation, mouvement large). */
const centers = (state: string) => [4, 13, 22, 31, 40, 49].map((i) => state[i]).join("");

/**
 * Exercice pour une formule : le joueur reprend le cube dans sa tenue de départ à la fin
 * de chaque répétition (rotation de retour, sans mouvement). On garde la formule telle
 * quelle ; un AUF n'est ajouté que si le cube ne revient pas au départ en 6 répétitions.
 */
export function exerciseFor(alg: string): { alg: string; reps: number; extra?: string } | null {
  const back = HOLDINGS.find((r) => centers(applyAlg(SOLVED, `${alg} ${r}`)) === centers(SOLVED)) ?? "";
  let best: { alg: string; reps: number; extra?: string } | null = null;
  for (const auf of ["", "U", "U'", "U2"]) {
    const extra = [back, auf].filter(Boolean).join(" ");
    const reps = cycleLength(extra ? `${alg} ${extra}` : alg);
    if (reps !== null && !best) best = { alg, reps, ...(extra ? { extra } : {}) };
  }
  return best;
}

/**
 * Quarts de tour envoyés par le cube connecté pendant les k premières répétitions
 * (repère cube). Les rotations de l'algo sont prises en compte : le joueur garde le
 * cube tourné d'une répétition à l'autre (V-perm avec y…).
 */
export function cubeMoves(ex: WarmupExercise, k = ex.reps): string[] {
  return physicalQuarters(repeat(repetitionAlg(ex), k)).map(switchFrame);
}

/** États attendus (repère cube) : index k = après k répétitions ; le dernier = le départ. */
export function expectedStates(start: string, ex: WarmupExercise): string[] {
  return Array.from({ length: ex.reps + 1 }, (_, k) => (k === 0 ? start : applyAlg(start, cubeMoves(ex, k).join(" "))));
}

/** Tous les triggers proposés : chaque trigger en main droite et en main gauche. */
export function triggerExercises(): WarmupExercise[] {
  return TRIGGERS.flatMap((t) =>
    [
      { label: t.name, alg: t.alg, left: false },
      { label: `${t.name} (main gauche)`, alg: mirrorAlg(t.alg), left: true },
    ].map(({ label, alg, left }) => ({ kind: "trigger" as const, label, alg, reps: cycleLength(alg)!, ...(left ? { left } : {}) })),
  );
}

export interface PllChoice {
  id: string;
  alg: string;
  status: "known" | "learning";
}

/** Mélange (Fisher-Yates) avec un tirage injecté, pour les tests. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Triggers tirés au hasard, dont au plus un en main gauche. */
function drawTriggers(count: number, random: () => number): WarmupExercise[] {
  const out: WarmupExercise[] = [];
  for (const ex of shuffle(triggerExercises(), random)) {
    if (out.length === count) break;
    if (ex.left && out.some((e) => e.left)) continue;
    out.push(ex);
  }
  return out;
}

/**
 * Tirage d'une séance : 3 triggers (au plus un en main gauche) puis jusqu'à 5 PLL (les maîtrisées d'abord, complétées
 * par celles à travailler s'il en manque), dans un ordre au hasard.
 */
export function drawWarmup(plls: readonly PllChoice[], random: () => number = Math.random, triggers = 3, pllCount = 5): WarmupExercise[] {
  const known = shuffle(plls.filter((p) => p.status === "known"), random);
  const learning = shuffle(plls.filter((p) => p.status === "learning"), random);
  const chosen = [...known, ...learning].slice(0, pllCount);
  const pllExercises = shuffle(chosen, random).flatMap((p) => {
    const ex = exerciseFor(p.alg);
    return ex ? [{ kind: "pll" as const, label: `${p.id}-perm`, ...ex }] : [];
  });
  return [...drawTriggers(triggers, random), ...pllExercises];
}

// Les 24 façons de tenir le cube (face du haut × face de devant), en rotations depuis
// le repère joueur (jaune en haut, vert devant).
const HOLDINGS = ["", "x", "x2", "x'", "z", "z'"].flatMap((a) => ["", "y", "y2", "y'"].map((b) => `${a} ${b}`.trim()));

/**
 * Façon de tenir le cube, choisie par le joueur : couleur du haut et de devant, données
 * par la face qui porte cette couleur dans le repère joueur (U jaune, F vert, R orange…).
 */
export interface Holding {
  up: Face;
  front: Face;
}

export const DEFAULT_HOLDING: Holding = { up: "U", front: "F" };

/** Couleurs possibles devant quand on a choisi celle du haut (les 4 faces voisines). */
export function frontChoices(up: Face): Face[] {
  return (["F", "R", "B", "L", "U", "D"] as Face[]).filter((f) => f !== up && f !== OPPOSITE[up]);
}

/** Rotation (depuis jaune en haut, vert devant) qui donne cette tenue. */
export function holdingRotation({ up, front }: Holding): string {
  const r = HOLDINGS.find((rot) => {
    const s = applyAlg(SOLVED, rot);
    return s[4] === up && s[22] === front; // centres U et F après la rotation
  });
  if (r === undefined) throw new Error(`Tenue impossible : ${up} en haut, ${front} devant`);
  return r;
}

const QUARTERS = ["U", "U'", "R", "R'", "F", "F'", "D", "D'", "L", "L'", "B", "B'"];

/** Écart toléré : un U2 fait en U' U', etc. */
const LOOKAHEAD = 3;
/** Mouvements justes d'affilée après un écart pour repartir de là. */
const REANCHOR = 6;
/** Retour en arrière toléré (mouvements défaits). */
const LOOKBACK = 8;

/**
 * Suivi d'un exercice sur le cube connecté, mouvement par mouvement, d'après l'état réel
 * du cube : position dans la formule, répétitions faites, écart éventuel (mouvements à
 * défaire). La façon de tenir le cube est imposée (réglage du joueur) : quand elle était
 * devinée, plusieurs tenues collaient aux premiers mouvements et le suivi se trompait.
 */
export class WarmupTracker {
  readonly expectedMoves: number;
  /** Quarts de tour par répétition. */
  readonly perRep: number;
  /** État de départ attendu (et d'arrivée : l'exercice boucle), repère cube. */
  get startState(): string {
    return this.states[0];
  }

  /**
   * Le cube n'était pas au départ de l'exercice (mouvements en trop à la fin du précédent) :
   * tant qu'il n'y est pas revenu, rien ne compte.
   */
  settling: boolean;

  /** Quarts de tour attendus (repère cube), toutes répétitions. */
  readonly expected: string[];
  /** Rotation qui donne la tenue du joueur (pour lui traduire les corrections). */
  private readonly rotation: string;
  /** États attendus (repère cube) : index k = après k quarts de tour. */
  private states: string[];
  private blocks: AxisBlock[];
  /** États du cube reçus (les derniers), pour se raccrocher après un écart. */
  private history: string[] = [];
  /** Quarts de tour de la formule déjà faits (sur toutes les répétitions). */
  pos = 0;
  /** Quarts de tour reçus. */
  moves = 0;
  /** Mouvements reçus depuis le dernier point de la formule (repère cube). */
  private offTrack: string[] = [];
  firstMoveAt: number | null = null;
  finishedAt: number | null = null;

  constructor(
    readonly exercise: WarmupExercise,
    start: string,
    holding: Holding = DEFAULT_HOLDING,
    /**
     * Mouvements faits depuis `start` avant le début de l'exercice (en trop à la fin du
     * précédent, repère cube) : à défaire d'abord, sans compter ni lancer le chrono.
     */
    carry: readonly string[] = [],
  ) {
    this.offTrack = [...carry];
    this.settling = carry.length > 0;
    this.rotation = holdingRotation(holding);
    const moves = physicalQuarters(`${this.rotation} ${repeat(repetitionAlg(exercise), exercise.reps)}`).map(switchFrame);
    this.expected = moves;
    this.expectedMoves = moves.length;
    this.perRep = moves.length / exercise.reps;
    this.states = this.statesFrom(start);
    this.blocks = axisBlocks(moves, this.states, this.perRep);
  }

  private statesFrom(start: string): string[] {
    const states = [start];
    for (const m of this.expected) states.push(applyAlg(states[states.length - 1], m));
    return states;
  }

  /**
   * Après un écart, le joueur a continué la formule sans défaire (quart de tour perdu par
   * le cube, U au lieu de U2…) : si ses derniers mouvements font un bout de la formule, on
   * repart de là (le départ attendu est recalculé), au lieu de rester perdu.
   */
  private reanchor(state: string): boolean {
    const m = Math.min(REANCHOR, this.perRep);
    if (this.offTrack.length < m || this.history.length <= m) return false;
    const before = this.history[this.history.length - 1 - m];
    const candidates = Array.from({ length: this.expectedMoves - m + 1 }, (_, i) => i + m).sort(
      (a, b) => Math.abs(a - this.pos) - Math.abs(b - this.pos),
    );
    const p = candidates.find((c) => applyAlg(before, this.expected.slice(c - m, c).join(" ")) === state);
    if (p === undefined || p === this.expectedMoves) return false;
    const undo = this.expected.slice(0, p).reverse().map(invertQuarter).join(" ");
    this.states = this.statesFrom(applyAlg(state, undo));
    this.blocks = axisBlocks(this.expected, this.states, this.perRep);
    this.pos = p;
    this.offTrack = [];
    this.pending = false;
    return true;
  }

  /** Répétitions terminées. */
  get done(): number {
    return Math.floor(this.pos / this.perRep);
  }

  get finished(): boolean {
    return this.pos === this.expectedMoves;
  }

  /** Mouvements en trop (erreurs, corrections). */
  get extraMoves(): number {
    return Math.max(0, this.moves - this.expectedMoves);
  }

  /** Quarts de tour faits dans la répétition en cours (pour allumer la formule). */
  get posInRep(): number {
    return this.finished ? this.perRep : this.pos % this.perRep;
  }

  /** Le joueur s'est-il écarté de la formule ? (pas quand il est à un quart de tour de la suite) */
  get lost(): boolean {
    return this.offTrack.length > 0 && !this.pending;
  }

  /**
   * Un seul mouvement hors formule, mais un quart de tour de plus retombe sur la suite :
   * U2 fait dans l'autre sens… Ce n'est pas une erreur.
   */
  private pending = false;

  /**
   * Mouvements à faire pour revenir sur la formule (tels que le joueur tient le cube) ;
   * null si l'écart est trop grand.
   */
  corrections(): string[] | null {
    if (this.offTrack.length > 6) return null;
    return [...this.offTrack].reverse().map((m) => playerMove(invertQuarter(m), this.rotation));
  }

  /**
   * Position atteinte : la plus proche vers l'avant (un R' en fin de répétition suivi du
   * R du début de la suivante redonne un état déjà vu : il ne faut pas sauter), sinon
   * dans le bloc de faces opposées en cours (M2 = droite + gauche dans n'importe quel ordre
   * et sens), sinon la plus proche en arrière (mouvements défaits) ; -1 si aucune.
   */
  private find(state: string): number {
    const hi = Math.min(this.pos + LOOKAHEAD, this.expectedMoves);
    for (let i = this.pos + 1; i <= hi; i++) if (this.states[i] === state) return i;
    const inBlock = this.blocks.find((b) => b.start <= this.pos && this.pos < b.end)?.states.get(state);
    if (inBlock !== undefined) return inBlock;
    for (let i = this.pos; i >= Math.max(0, this.pos - LOOKBACK); i--) if (this.states[i] === state) return i;
    return -1;
  }

  /**
   * État réel renvoyé par le cube (sans mouvement) : si le modèle s'était trompé
   * (mouvement perdu en route), le suivi se recale dessus.
   */
  observe(state: string, now: number): void {
    if (this.finished || state === this.history[this.history.length - 1]) return;
    const found = this.find(state);
    if (found < 0) return;
    if (this.settling) {
      this.settling = false;
      if (found === 0) {
        this.offTrack = [];
        return;
      }
    }
    this.pos = found;
    this.offTrack = [];
    this.pending = false;
    this.history.push(state);
    if (this.finished) this.finishedAt = now;
  }

  /** À appeler après chaque quart de tour reçu : mouvement et état du cube (repère cube). */
  move(move: string, state: string, now: number): void {
    if (this.finished) return;
    this.history.push(state);
    if (this.history.length > 32) this.history.shift();
    const found = this.find(state);
    if (this.settling) {
      if (found < 0) {
        this.offTrack.push(move);
        return;
      }
      this.settling = false;
      this.offTrack = [];
      if (found === 0) return; // revenu au départ : l'exercice peut commencer
    }
    this.moves++;
    this.firstMoveAt ??= now;
    if (found < 0) {
      this.offTrack.push(move);
      if (this.reanchor(state)) return;
      // À un quart de tour de la suite de la formule ? (demi-tour dans l'autre sens…)
      const ahead = new Set(this.states.slice(this.pos + 1, this.pos + 1 + LOOKAHEAD));
      this.pending = this.offTrack.length === 1 && QUARTERS.some((q) => ahead.has(applyAlg(state, q)));
      return;
    }
    this.pos = found;
    this.offTrack = [];
    this.pending = false;
    if (this.finished) this.finishedAt = now;
  }
}

const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };

/**
 * Suite de quarts de tour sur un même axe (faces opposées : elles commutent). Les états
 * intermédiaires possibles, quel que soit l'ordre et le sens des demi-tours, avec la
 * position (quarts de tour faits) qu'ils représentent. Un bloc ne déborde pas sur la
 * répétition suivante.
 */
interface AxisBlock {
  start: number;
  end: number;
  states: Map<string, number>;
}

function axisBlocks(moves: readonly string[], states: readonly string[], perRep: number): AxisBlock[] {
  const blocks: AxisBlock[] = [];
  let start = 0;
  for (let i = 1; i <= moves.length; i++) {
    // Coupé à chaque répétition : M2 en fin de H-perm puis M2 au début de la suivante.
    if (i < moves.length && i % perRep !== 0 && AXIS[moves[i][0]] === AXIS[moves[start][0]]) continue;
    const faces = [...new Set(moves.slice(start, i).map((m) => m[0]))];
    // Pour chaque face : quarts de tour prévus (nombre) et rotation nette (mod 4).
    const plan = faces.map((f) => {
      const own = moves.slice(start, i).filter((m) => m[0] === f);
      return { f, count: own.length, net: own.reduce((n, m) => n + (m.endsWith("'") ? 3 : 1), 0) % 4 };
    });
    const map = new Map<string, number>();
    const combos = (k: number, alg: string, done: number): void => {
      if (k === plan.length) {
        const s = applyAlg(states[start], alg);
        if (!map.has(s)) map.set(s, start + done);
        return;
      }
      const { f, count, net } = plan[k];
      for (let a = 0; a < 4; a++) {
        const dist = Math.min((net - a + 4) % 4, (a - net + 4) % 4);
        if (dist > count) continue; // trop loin : c'est une erreur, pas une variante
        combos(k + 1, `${alg} ${Array(a).fill(f).join(" ")}`, done + Math.max(0, count - dist));
      }
    };
    combos(0, "", 0);
    blocks.push({ start, end: i, states: map });
    start = i;
  }
  return blocks;
}

const invertQuarter = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`);

const playerCache = new Map<string, string>();
/** Mouvement du cube (repère cube) exprimé comme le joueur le voit, en tenant le cube ainsi. */
export function playerMove(cubeMove: string, holding: string): string {
  const key = `${holding}|${cubeMove}`;
  let p = playerCache.get(key);
  if (!p) {
    p = QUARTERS.find((q) => switchFrame(physicalQuarters(`${holding} ${q}`)[0]) === cubeMove) ?? cubeMove;
    playerCache.set(key, p);
  }
  return p;
}

/** Quarts de tour de chaque mouvement écrit de la formule (rotation = 0), pour l'allumer. */
export function moveWeights(alg: string): number[] {
  return alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const clean = tok.replace(/[()]/g, "");
      return clean ? physicalQuarters(clean).length : 0;
    });
}

/**
 * État de chaque mouvement écrit de la formule, d'après les quarts de tour faits dans la
 * répétition : "done", "current" (le prochain à faire) ou "todo".
 */
export function moveProgress(weights: readonly number[], posInRep: number): ("done" | "current" | "todo")[] {
  let end = 0;
  let currentGiven = false;
  return weights.map((w) => {
    end += w;
    // Une rotation (poids 0) est « faite » dès que le mouvement suivant a commencé.
    const done = end < posInRep || (end === posInRep && w > 0);
    if (done) return "done";
    if (!currentGiven) {
      currentGiven = true;
      return "current";
    }
    return "todo";
  });
}
