// Guide l'utilisateur pendant qu'il applique un mélange sur le cube connecté.
// Le cube n'envoie que des quarts de tour : « R2 » se fait en R R (ou R' R').
// En cas d'erreur, on calcule les corrections (inverse des mauvais mouvements)
// à faire avant de reprendre le mélange.

import { formatTurn, parseAlg, parseMove, type Turn } from "./facelets";

export type ScrambleStepState = "done" | "current" | "pending";

export interface ScrambleView {
  steps: { text: string; state: ScrambleStepState }[];
  /** Mouvements à faire pour annuler les erreurs, dans l'ordre. Vide si tout va bien. */
  corrections: string[];
  done: boolean;
}

const mod4 = (n: number) => (((n % 4) + 4) % 4) as 0 | 1 | 2 | 3;

export class ScrambleTracker {
  private readonly moves: Turn[];
  private index = 0;
  /** Quarts de tour déjà faits sur le mouvement courant. */
  private partial: 0 | 1 | 2 | 3 = 0;
  private corrections: Turn[] = [];

  constructor(readonly scramble: string) {
    this.moves = parseAlg(scramble);
  }

  get done(): boolean {
    return this.index >= this.moves.length && this.corrections.length === 0;
  }

  apply(move: string): void {
    const turn = parseMove(move);

    // 1. Des corrections sont en attente : on les traite d'abord.
    const head = this.corrections[0];
    if (head) {
      if (head.face === turn.face) {
        const left = mod4(head.amount - turn.amount);
        if (left === 0) this.corrections.shift();
        else head.amount = left;
      } else {
        this.corrections.unshift(inverse(turn));
      }
      return;
    }

    // 2. Mouvement attendu (éventuellement en plusieurs quarts de tour).
    const current = this.moves[this.index];
    if (current && current.face === turn.face) {
      this.partial = mod4(this.partial + turn.amount);
      if (this.partial === current.amount) {
        this.index++;
        this.partial = 0;
      }
      return;
    }

    // 3. Mauvaise face : il faudra l'annuler.
    this.corrections.unshift(inverse(turn));
  }

  view(): ScrambleView {
    const steps = this.moves.map((turn, i) => {
      if (i < this.index) return { text: formatTurn(turn), state: "done" as const };
      if (i === this.index) {
        const left = mod4(turn.amount - this.partial);
        return { text: formatTurn({ face: turn.face, amount: left || turn.amount } as Turn), state: "current" as const };
      }
      return { text: formatTurn(turn), state: "pending" as const };
    });
    return { steps, corrections: this.corrections.map(formatTurn), done: this.done };
  }
}

function inverse(turn: Turn): Turn {
  return { face: turn.face, amount: mod4(4 - turn.amount) as Turn["amount"] };
}
