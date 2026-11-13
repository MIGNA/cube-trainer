import type { Face } from "../cube/facelets";
import { getDb } from "./db";

/** État d'apprentissage d'un cas OLL/PLL (absent = non appris). */
export type CaseStatus = "new" | "learning" | "known";

export interface Settings {
  /** Dernière adresse MAC de cube connue (pour la reconnexion si la détection auto échoue). */
  lastCubeMac: string;
  /** Inspection WCA de 15 s avant chaque solve. */
  inspectionEnabled: boolean;
  crossColor: "white" | "yellow" | "green" | "blue" | "red" | "orange";
  /** État de chaque cas, par id ("T", "OLL 27"…). Les cas absents sont « non appris ». */
  caseStatus: Record<string, CaseStatus>;
  /** Algos choisis par cas (le premier est celui entraîné). Absent = algo standard. */
  caseAlgs: Record<string, string[]>;
  /** Tenue du cube pour l'entraînement : faces (repère joueur) dont la couleur est en haut / devant. */
  warmupHolding: { up: Face; front: Face };
}

const DEFAULTS: Settings = {
  lastCubeMac: "",
  inspectionEnabled: true,
  crossColor: "white",
  caseStatus: {},
  caseAlgs: {},
  warmupHolding: { up: "U", front: "F" },
};

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const value = await (await getDb()).get("settings", key);
  return (value ?? DEFAULTS[key]) as Settings[K];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await (await getDb()).put("settings", value, key);
}
