// Point d'accès unique au cube connecté pour toute l'appli.
// - `cubeStatus` : état de connexion observable par les vues.
// - `onCubeEvent` : abonnement aux événements, qui survit aux reconnexions.

import { signal } from "../app/signal";
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
  if (event.type === "battery" && status.state === "connected") {
    cubeStatus.set({ ...status, battery: event.level });
  } else if (event.type === "hardware" && status.state === "connected") {
    const parts = [event.name, event.hardwareVersion && `hw ${event.hardwareVersion}`, event.softwareVersion && `sw ${event.softwareVersion}`];
    cubeStatus.set({ ...status, hardware: parts.filter(Boolean).join(" · ") || undefined });
  } else if (event.type === "disconnect") {
    unsubscribeCurrent?.();
    unsubscribeCurrent = null;
    current = null;
    cubeStatus.set({ state: "disconnected" });
  }
  for (const l of listeners) l(event);
}

async function attach(cube: SmartCube): Promise<void> {
  current = cube;
  unsubscribeCurrent = cube.subscribe(handleEvent);
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
