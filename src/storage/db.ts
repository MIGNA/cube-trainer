// Base IndexedDB de l'appli. Chaque évolution du schéma = DB_VERSION + 1
// et un nouveau bloc `if (oldVersion < N)` dans upgrade() (jamais modifier les anciens blocs).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export type Penalty = "none" | "+2" | "DNF";

export interface Solve {
  id?: number;
  /** Date de fin du solve (ms depuis epoch). */
  date: number;
  /** Temps brut, sans pénalité. */
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  source: "manual" | "cube";
  /** Mouvements enregistrés par le cube connecté, si disponible (servira à l'analyse CFOP). */
  moves?: SolveMove[];
}

export interface SolveMove {
  /** Mouvement en notation standard ("R", "U'"…). */
  m: string;
  /** Temps en ms depuis le premier mouvement du solve. */
  t: number;
}

/** Séance d'entraînement (échauffement…), gardée pour suivre la progression. */
export interface TrainingSession {
  id?: number;
  /** Date de fin de la séance (ms depuis epoch). */
  date: number;
  kind: "warmup";
  items: TrainingItem[];
}

export interface TrainingItem {
  label: string;
  alg: string;
  reps: number;
  /** Temps de l'exercice (premier mouvement → fin), en ms. */
  timeMs: number;
  /** Fait avec le cube connecté (sinon chrono à la main). */
  connected: boolean;
  /** Quarts de tour attendus pour tout l'exercice. */
  expectedMoves: number;
  /** Quarts de tour reçus (cube connecté seulement). */
  moves?: number;
  /** Exercice passé sans être terminé. */
  skipped?: boolean;
}

interface CubeTrainerDB extends DBSchema {
  solves: {
    key: number;
    value: Solve;
    indexes: { "by-date": number };
  };
  settings: {
    key: string;
    value: unknown;
  };
  training: {
    key: number;
    value: TrainingSession;
    indexes: { "by-date": number };
  };
}

const DB_NAME = "cube-trainer";
const DB_VERSION = 2;

export type Db = IDBPDatabase<CubeTrainerDB>;

let dbPromise: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  dbPromise ??= openDB<CubeTrainerDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const solves = db.createObjectStore("solves", { keyPath: "id", autoIncrement: true });
        solves.createIndex("by-date", "date");
        db.createObjectStore("settings");
      }
      if (oldVersion < 2) {
        const training = db.createObjectStore("training", { keyPath: "id", autoIncrement: true });
        training.createIndex("by-date", "date");
      }
    },
  });
  return dbPromise;
}
