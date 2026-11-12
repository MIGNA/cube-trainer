// Échauffement : enchaînements de triggers et de PLL connues.
// Chaque exercice est répété jusqu'à ce que le cube revienne à son point de départ
// (sexy move ×6, T-perm ×2…) : pas besoin de mélanger, et le cube vérifie tout seul.
// Logique pure (tirage, répétitions, suivi) ; l'affichage est dans ui/views/training.ts.

import { SOLVED, allSolved, applyAlg } from "../cube/facelets";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { TRIGGERS, mirrorAlg } from "../cube/triggers";

export interface WarmupExercise {
  kind: "trigger" | "pll";
  label: string;
  /** Formule d'une répétition (repère joueur), AUF de fin compris si besoin. */
  alg: string;
  reps: number;
  /** Trigger en version main gauche. */
  left?: boolean;
}

const ALL = [...Array(54).keys()];
const MAX_REPS = 6;

/** Résolu à une rotation près (comparaison aux centres). */
const solvedState = (s: string) => allSolved(s, ALL);

const repeat = (alg: string, n: number) => Array(n).fill(alg).join(" ");

/** Nombre de répétitions qui ramènent le cube au départ (null si plus de 6). */
export function cycleLength(alg: string): number | null {
  let s = SOLVED;
  for (let n = 1; n <= MAX_REPS; n++) {
    s = applyAlg(s, alg);
    if (solvedState(s)) return n;
  }
  return null;
}

/**
 * Formule et nombre de répétitions d'un exercice. Si l'algo laisse la couche du haut
 * décalée (cycle trop long, V-perm ×12…), on ajoute un AUF à la fin : on garde la
 * version la plus courte en répétitions, sans AUF à égalité.
 */
export function exerciseFor(alg: string): { alg: string; reps: number } | null {
  let best: { alg: string; reps: number } | null = null;
  for (const auf of ["", "U", "U2", "U'"]) {
    const full = auf ? `${alg} ${auf}` : alg;
    const reps = cycleLength(full);
    if (reps !== null && (!best || reps < best.reps)) best = { alg: full, reps };
  }
  return best;
}

/**
 * Quarts de tour envoyés par le cube connecté pendant les k premières répétitions
 * (repère cube). Les rotations de l'algo sont prises en compte : le joueur garde le
 * cube tourné d'une répétition à l'autre (V-perm avec y…).
 */
export function cubeMoves(ex: WarmupExercise, k = ex.reps): string[] {
  return physicalQuarters(repeat(ex.alg, k)).map(switchFrame);
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

const QUARTERS = ["U", "U'", "R", "R'", "F", "F'", "D", "D'", "L", "L'", "B", "B'"];

/** Suite attendue pour une façon de tenir le cube : mouvements et états (repère cube). */
interface Path {
  holding: string;
  moves: string[];
  states: string[];
}

/** Écart toléré : la tranche M arrive en deux faces dans un ordre quelconque, etc. */
const LOOKAHEAD = 3;
/** Retour en arrière toléré (mouvements défaits). */
const LOOKBACK = 8;

/**
 * Suivi d'un exercice sur le cube connecté, mouvement par mouvement, d'après l'état réel
 * du cube : position dans la formule, répétitions faites, écart éventuel (mouvements à
 * défaire). La façon de tenir le cube est libre : elle est reconnue dès les premiers
 * mouvements puis gardée.
 */
export class WarmupTracker {
  readonly expectedMoves: number;
  /** Quarts de tour par répétition. */
  readonly perRep: number;
  private readonly allPaths: Path[];
  private paths: Path[];
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
  ) {
    const seen = new Set<string>();
    const all = repeat(exercise.alg, exercise.reps);
    this.allPaths = HOLDINGS.flatMap((holding) => {
      const moves = physicalQuarters(`${holding} ${all}`).map(switchFrame);
      const key = moves.join(" ");
      if (seen.has(key)) return [];
      seen.add(key);
      const states = [start];
      for (const m of moves) states.push(applyAlg(states[states.length - 1], m));
      return [{ holding, moves, states }];
    });
    this.paths = this.allPaths;
    this.expectedMoves = this.paths[0].moves.length;
    this.perRep = this.expectedMoves / exercise.reps;
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

  /** Le joueur s'est-il écarté de la formule ? */
  get lost(): boolean {
    return this.offTrack.length > 0;
  }

  /**
   * Mouvements à faire pour revenir sur la formule (repère du joueur, tel qu'il tient
   * le cube) ; null si l'écart est trop grand (mieux vaut recommencer l'exercice).
   */
  corrections(): string[] | null {
    if (this.offTrack.length > 6) return null;
    const holding = this.paths[0].holding;
    return [...this.offTrack].reverse().map((m) => toPlayer(invertQuarter(m), holding));
  }

  /** À appeler après chaque quart de tour reçu : mouvement et état du cube (repère cube). */
  move(move: string, state: string, now: number): void {
    if (this.finished) return;
    this.moves++;
    this.firstMoveAt ??= now;
    let best = -1;
    let matching: Path[] = [];
    for (const path of this.paths) {
      const hi = Math.min(this.pos + LOOKAHEAD, this.expectedMoves);
      for (let i = hi; i >= Math.max(0, this.pos - LOOKBACK); i--) {
        if (path.states[i] !== state) continue;
        if (i > best) {
          best = i;
          matching = [];
        }
        if (i === best) matching.push(path);
        break;
      }
    }
    if (best < 0) {
      this.offTrack.push(move);
      return;
    }
    // Façon de tenir le cube : on ne garde que celles qui collent à ce qui a été fait ;
    // revenu au point de départ, toutes redeviennent possibles.
    this.paths = best > 0 ? matching : this.allPaths;
    this.pos = best;
    this.offTrack = [];
    if (this.finished) this.finishedAt = now;
  }
}

const invertQuarter = (m: string) => (m.endsWith("'") ? m.slice(0, -1) : `${m}'`);

const playerCache = new Map<string, string>();
/** Mouvement du cube (repère cube) exprimé comme le joueur le voit, en tenant le cube ainsi. */
function toPlayer(cubeMove: string, holding: string): string {
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
