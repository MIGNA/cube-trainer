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

/**
 * Position d'un numéro d'ordre du cube (0-255, en boucle) par rapport à celui de l'état
 * du modèle : déjà compté (« behind » ou « same »), ou nouveau (« ahead »).
 */
export function serialOrder(model: number, serial: number): "same" | "ahead" | "behind" {
  const d = (serial - model) & 0xff;
  return d === 0 ? "same" : d < 128 ? "ahead" : "behind";
}

/** Numéro d'ordre du dernier mouvement compté dans `cubeFacelets` (null = inconnu). */
let modelSerial: number | null = null;

/**
 * État reçu en avance sur les mouvements : des mouvements ont été perdus en route (souvent
 * pendant un M, deux faces qui tournent ensemble). La bibliothèque GAN les redemande au cube
 * et les envoie un peu plus tard ; sans attente, ils arriveraient « déjà comptés » et ne
 * seraient jamais transmis (un exercice verrait l'état changer sans les mouvements).
 * L'état est donc gardé jusqu'à l'arrivée des mouvements manquants, ou MISSING_WAIT_MS.
 */
let pending: { event: Extract<CubeEvent, { type: "facelets" }>; timer: number } | null = null;
const MISSING_WAIT_MS = 1500;

function dropPending(): void {
  if (pending) clearTimeout(pending.timer);
  pending = null;
}

function flushPending(): void {
  const p = pending;
  dropPending();
  if (p) handleEvent(p.event, true);
}

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

/** Redemande l'état au cube ; la réponse est acceptée quel que soit son numéro d'ordre. */
export async function resyncCube(): Promise<void> {
  modelSerial = null;
  dropPending();
  await current?.requestFacelets();
}

/** Déclare le cube résolu (le cube remet son compteur à zéro). */
export async function markCubeSolved(): Promise<void> {
  modelSerial = null;
  dropPending();
  await current?.markSolved();
}

export function isWebBluetoothAvailable(): boolean {
  return "bluetooth" in navigator;
}

function handleEvent(event: CubeEvent, held = false): void {
  const status = cubeStatus.get();
  if (event.type === "move") {
    // Le cube envoie parfois un mouvement déjà compté dans l'état qu'il a renvoyé
    // (mouvement perdu puis récupéré) : l'appliquer deux fois fausserait le modèle.
    if (event.serial !== undefined && modelSerial !== null && serialOrder(modelSerial, event.serial) !== "ahead") {
      if (import.meta.env.DEV) console.log(`[cube] ${event.move} n°${event.serial} déjà compté (état n°${modelSerial}) : ignoré`);
      return;
    }
    if (event.serial !== undefined) modelSerial = event.serial;
    const facelets = cubeFacelets.get();
    if (facelets) cubeFacelets.set(applyMove(facelets, event.move));
  } else if (event.type === "facelets") {
    // Mouvements manquants (numéro d'ordre de l'état en avance) : on attend qu'ils arrivent.
    if (!held && event.serial !== undefined && modelSerial !== null && serialOrder(modelSerial, event.serial) === "ahead") {
      if (import.meta.env.DEV) console.log(`[cube] état n°${event.serial} en avance (modèle n°${modelSerial}) : mouvements manquants attendus`);
      dropPending();
      pending = { event, timer: window.setTimeout(flushPending, MISSING_WAIT_MS) };
      return;
    }
    // État en retard sur les mouvements déjà reçus : on le laisse de côté.
    if (event.serial !== undefined && modelSerial !== null && serialOrder(modelSerial, event.serial) === "behind") {
      if (import.meta.env.DEV) console.log(`[cube] état n°${event.serial} en retard (modèle n°${modelSerial}) : ignoré`);
      return;
    }
    if (isValidFacelets(event.facelets)) {
      if (event.serial !== undefined) modelSerial = event.serial;
      const expected = cubeFacelets.get();
      syncMismatch.set(expected != null && expected !== event.facelets);
      if (syncMismatch.get()) console.warn("Écart entre le modèle et le cube", { expected, actual: event.facelets, serial: event.serial });
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
    modelSerial = null;
    dropPending();
    cubeFacelets.set(null);
    syncMismatch.set(false);
    cubeStatus.set({ state: "disconnected" });
  }
  for (const l of listeners) l(event);
  // Mouvements manquants tous arrivés : l'état mis en attente peut passer.
  if (event.type === "move" && pending && modelSerial !== null && serialOrder(modelSerial, pending.event.serial!) !== "ahead") flushPending();
}

async function attach(cube: SmartCube): Promise<void> {
  current = cube;
  modelSerial = null;
  dropPending();
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
