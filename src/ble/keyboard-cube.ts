// Faux cube piloté au clavier, pour développer sur PC sans le vrai cube.
//   u d r l f b      → U D R L F B
//   Maj + lettre     → mouvement inverse (U', D', …)
// Il n'a pas d'état propre : l'appli le suppose résolu à la connexion et calcule
// la suite à partir des mouvements. « Marquer comme résolu » le remet à zéro.

import { SOLVED } from "../cube/facelets";
import { createEmitter, type SmartCube } from "./smart-cube";

const FACES = new Set(["U", "D", "R", "L", "F", "B"]);

export function connectKeyboard(): SmartCube {
  const emitter = createEmitter();

  function onKeyDown(e: KeyboardEvent): void {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable]")) return;

    const face = e.key.toUpperCase();
    if (!FACES.has(face)) return;
    e.preventDefault();
    emitter.emit({
      type: "move",
      move: e.shiftKey ? `${face}'` : face,
      timestamp: performance.now(),
      cubeTimestamp: null,
    });
  }

  window.addEventListener("keydown", onKeyDown);

  return {
    kind: "keyboard",
    name: "Cube clavier (dev)",
    id: "keyboard",
    subscribe: emitter.subscribe,
    requestFacelets: async () => {},
    requestBattery: async () => {},
    requestHardware: async () => {},
    markSolved: async () => emitter.emit({ type: "facelets", facelets: SOLVED }),
    async disconnect() {
      window.removeEventListener("keydown", onKeyDown);
      emitter.emit({ type: "disconnect" });
    },
  };
}
