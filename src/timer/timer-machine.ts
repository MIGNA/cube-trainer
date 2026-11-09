// Machine à états du chrono, indépendante du DOM (testable).
// Le temps est toujours fourni par l'appelant (performance.now() en vrai).
//
//   idle ──appui/relâche──▶ inspecting (si inspection activée)
//   idle | inspecting ──appui──▶ holding ──maintien 300 ms──▶ ready
//   ready ──relâche──▶ running ──appui──▶ idle (résultat émis)
//   holding ──relâche trop tôt──▶ retour à l'état précédent

import type { Penalty } from "../storage/db";

export const HOLD_MS = 300;
export const INSPECTION_MS = 15_000;
/** Au-delà de 15 s d'inspection : +2 ; au-delà de 17 s : DNF (règle WCA A3). */
export const INSPECTION_DNF_MS = 17_000;

export type TimerState =
  | { name: "idle" }
  | { name: "inspecting"; startedAt: number }
  | { name: "holding"; since: number; inspectionStartedAt: number | null }
  | { name: "ready"; inspectionStartedAt: number | null }
  | { name: "running"; startedAt: number; penalty: Penalty };

export interface TimerResult {
  timeMs: number;
  penalty: Penalty;
}

export class TimerMachine {
  state: TimerState = { name: "idle" };

  constructor(
    private readonly options: { inspection: () => boolean; onFinish: (result: TimerResult) => void },
  ) {}

  press(now: number): void {
    const s = this.state;
    switch (s.name) {
      case "idle":
        this.state = { name: "holding", since: now, inspectionStartedAt: null };
        break;
      case "inspecting":
        this.state = { name: "holding", since: now, inspectionStartedAt: s.startedAt };
        break;
      case "running": {
        const timeMs = now - s.startedAt;
        // Le relâchement qui suit tombe sur « idle » et n'a donc aucun effet.
        this.state = { name: "idle" };
        this.options.onFinish({ timeMs, penalty: s.penalty });
        break;
      }
      default:
        break;
    }
  }

  release(now: number): void {
    const s = this.state;
    if (s.name === "ready") {
      this.state = { name: "running", startedAt: now, penalty: inspectionPenalty(s.inspectionStartedAt, now) };
    } else if (s.name === "holding") {
      if (s.inspectionStartedAt != null) {
        this.state = { name: "inspecting", startedAt: s.inspectionStartedAt };
      } else if (this.options.inspection()) {
        // Un simple tap au repos lance l'inspection.
        this.state = { name: "inspecting", startedAt: now };
      } else {
        this.state = { name: "idle" };
      }
    }
  }

  /** À appeler régulièrement (requestAnimationFrame) : passe de holding à ready. */
  tick(now: number): void {
    const s = this.state;
    if (s.name === "holding" && now - s.since >= HOLD_MS) {
      // Avec l'inspection activée, il faut d'abord la lancer par un tap.
      if (s.inspectionStartedAt == null && this.options.inspection()) return;
      this.state = { name: "ready", inspectionStartedAt: s.inspectionStartedAt };
    }
  }

  /** Annule tout (inspection en cours, chrono…) et revient au repos. */
  cancel(): void {
    this.state = { name: "idle" };
  }
}

export function inspectionPenalty(inspectionStartedAt: number | null, now: number): Penalty {
  if (inspectionStartedAt == null) return "none";
  const elapsed = now - inspectionStartedAt;
  if (elapsed > INSPECTION_DNF_MS) return "DNF";
  if (elapsed > INSPECTION_MS) return "+2";
  return "none";
}
