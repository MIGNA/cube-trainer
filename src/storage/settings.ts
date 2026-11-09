import { getDb } from "./db";

export interface Settings {
  /** Dernière adresse MAC de cube connue (pour la reconnexion si la détection auto échoue). */
  lastCubeMac: string;
  /** Inspection WCA de 15 s avant chaque solve. */
  inspectionEnabled: boolean;
  crossColor: "white" | "yellow" | "green" | "blue" | "red" | "orange";
}

const DEFAULTS: Settings = {
  lastCubeMac: "",
  inspectionEnabled: true,
  crossColor: "white",
};

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const value = await (await getDb()).get("settings", key);
  return (value ?? DEFAULTS[key]) as Settings[K];
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await (await getDb()).put("settings", value, key);
}
