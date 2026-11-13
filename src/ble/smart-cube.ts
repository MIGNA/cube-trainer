// Interface commune à tous les cubes connectés. Le reste de l'appli ne dépend
// que de ce fichier, jamais directement de gan-web-bluetooth : on peut ainsi
// développer avec le faux cube clavier et ajouter d'autres marques plus tard.

export type CubeEvent =
  | {
      type: "move";
      /** Notation standard : "R", "U'", … */
      move: string;
      /** Horodatage local (ms, horloge performance.now() du navigateur). */
      timestamp: number;
      /** Horodatage interne du cube si disponible (plus précis pour les temps d'exécution). */
      cubeTimestamp: number | null;
      /** Numéro d'ordre du cube (0-255, +1 par mouvement), s'il en donne un. */
      serial?: number;
    }
  | {
      type: "facelets";
      /** 54 caractères, ordre Kociemba URFDLB. */
      facelets: string;
      /** Numéro d'ordre du dernier mouvement compté dans cet état, s'il est connu. */
      serial?: number;
    }
  | { type: "battery"; level: number }
  | { type: "hardware"; name?: string; hardwareVersion?: string; softwareVersion?: string }
  | { type: "disconnect" };

export type CubeListener = (event: CubeEvent) => void;

export interface SmartCube {
  readonly kind: "gan" | "keyboard";
  readonly name: string;
  /** MAC pour un cube réel, identifiant fixe pour le faux cube. */
  readonly id: string;
  subscribe(listener: CubeListener): () => void;
  requestFacelets(): Promise<void>;
  requestBattery(): Promise<void>;
  requestHardware(): Promise<void>;
  /** Déclare l'état physique actuel du cube comme l'état résolu. */
  markSolved(): Promise<void>;
  disconnect(): Promise<void>;
}

export { SOLVED as SOLVED_FACELETS } from "../cube/facelets";

/** Petit émetteur partagé par les implémentations. */
export function createEmitter() {
  const listeners = new Set<CubeListener>();
  return {
    subscribe(listener: CubeListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(event: CubeEvent) {
      for (const l of listeners) l(event);
    },
  };
}
