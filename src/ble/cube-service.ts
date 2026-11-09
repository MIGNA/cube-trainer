// Point d'accès unique au cube connecté pour toute l'appli.
// - `cubeStatus` : état de connexion observable par les vues.
// - `onCubeEvent` : abonnement aux événements, qui survit aux reconnexions.
// - `cubeFacelets` : état du cube suivi en continu (null = inconnu). Il est mis à
//   jour AVANT de notifier les abonnés : un abonné à "move" lit l'état d'après le mouvement.

import { signal } from "../app/signal";
import { SOLVED, applyMove, isValidFacelets } from "../cube/facelets";
import { getSetting, setSetting } from "../storage/settings";
import { connectGan } from "./gan-cube";
import { connectKeyboard } from "./keyboard-cube";
import type { CubeEvent, CubeListener, SmartCube } from "./smart-cube";

export type CubeStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | {
      state: "connected";
      kind: SmartCube["kind"];
      name: string;
      id: string;
      battery?: number;
      hardware?: string;
    }
  | { state: "error"; message: string };

export const cubeStatus = signal<CubeStatus>({ state: "disconnected" });

/** État actuel du cube (54 facelets, ordre Kociemba), ou null s'il est inconnu. */
export const cubeFacelets = signal<string | null>(null);

/**
 * Vrai si le cube a renvoyé un état différent de celui calculé par l'appli
 * (mouvement perdu, ou erreur du modèle). Remis à faux à chaque resynchronisation correcte.
 */
export const syncMismatch = signal(false);

const listeners = new Set<CubeListener>();
let current: SmartCube | null = null;
let unsubscribeCurrent: (() => void) | null = null;

export function onCubeEvent(listener: CubeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCube(): SmartCube | null {
  return current;
}

export function isWebBluetoothAvailable(): boolean {
  return "bluetooth" in navigator;
}

function handleEvent(event: CubeEvent): void {
  const status = cubeStatus.get();
  if (event.type === "move") {
    const facelets = cubeFacelets.get();
    if (facelets) cubeFacelets.set(applyMove(facelets, event.move));
  } else if (event.type === "facelets") {
    if (isValidFacelets(event.facelets)) {
      const expected = cubeFacelets.get();
      syncMismatch.set(expected != null && expected !== event.facelets);
      if (syncMismatch.get()) console.warn("Écart entre le modèle et le cube", { expected, actual: event.facelets });
      cubeFacelets.set(event.facelets);
    }
  } else if (event.type === "battery" && status.state === "connected") {
    cubeStatus.set({ ...status, battery: event.level });
  } else if (event.type === "hardware" && status.state === "connected") {
    const parts = [event.name, event.hardwareVersion && `hw ${event.hardwareVersion}`, event.softwareVersion && `sw ${event.softwareVersion}`];
    cubeStatus.set({ ...status, hardware: parts.filter(Boolean).join(" · ") || undefined });
  } else if (event.type === "disconnect") {
    unsubscribeCurrent?.();
    unsubscribeCurrent = null;
    current = null;
    cubeFacelets.set(null);
    syncMismatch.set(false);
    cubeStatus.set({ state: "disconnected" });
  }
  for (const l of listeners) l(event);
}

async function attach(cube: SmartCube): Promise<void> {
  current = cube;
  unsubscribeCurrent = cube.subscribe(handleEvent);
  // Le faux cube clavier n'a pas de capteur : on le suppose résolu au départ.
  cubeFacelets.set(cube.kind === "keyboard" ? SOLVED : null);
  syncMismatch.set(false);
  cubeStatus.set({ state: "connected", kind: cube.kind, name: cube.name, id: cube.id });
  await cube.requestHardware();
  await cube.requestFacelets();
  await cube.requestBattery();
}

/**
 * Connecte un cube GAN via Web Bluetooth (ouvre le sélecteur d'appareil de Chrome).
 * @param manualMac MAC saisie par l'utilisateur, prioritaire sur la détection automatique.
 */
export async function connectGanCube(manualMac?: string): Promise<void> {
  if (current) await disconnectCube();
  cubeStatus.set({ state: "connecting" });
  try {
    const savedMac = await getSetting("lastCubeMac");
    const typed = manualMac?.trim().toUpperCase() || null;
    const cube = await connectGan(async (isFallback) => typed ?? (isFallback ? savedMac || null : null));
    await setSetting("lastCubeMac", cube.id);
    await attach(cube);
  } catch (err) {
    current = null;
    const message = err instanceof Error ? err.message : String(err);
    // Fermeture du sélecteur par l'utilisateur : pas une vraie erreur.
    if (err instanceof DOMException && err.name === "NotFoundError") {
      cubeStatus.set({ state: "disconnected" });
    } else {
      cubeStatus.set({ state: "error", message });
    }
  }
}

export async function connectKeyboardCube(): Promise<void> {
  if (current) await disconnectCube();
  await attach(connectKeyboard());
}

export async function disconnectCube(): Promise<void> {
  if (!current) return;
  await current.disconnect();
  // Normalement le cube émet "disconnect" lui-même ; sinon on nettoie ici.
  if (current) handleEvent({ type: "disconnect" });
}
