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
  /** Mouvements enregistrés par le cube connecté, si disponible. */
  moves?: string[];
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
}

const DB_NAME = "cube-trainer";
const DB_VERSION = 1;

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
    },
  });
  return dbPromise;
}
