// Machine à états du chrono piloté par le cube connecté (indépendante du DOM).
//
//   needSolve ──cube résolu──▶ scrambling ──mélange correct──▶ inspecting | waiting
//   inspecting | waiting ──1er mouvement──▶ running ──cube résolu──▶ (résultat) scrambling
//
// L'état réel du cube (facelets) est fourni par l'appelant après chaque mouvement :
// c'est lui qui fait foi pour « résolu » et « bien mélangé ».

import type { Penalty } from "../storage/db";
import { inspectionPenalty } from "../timer/timer-machine";
import { SOLVED, applyAlg, isSolved } from "./facelets";
import { ScrambleTracker } from "./scramble-tracker";

export interface TimedMove {
  move: string;
  /** Horloge locale (performance.now). */
  timestamp: number;
  /** Horloge interne du cube, plus précise, si disponible. */
  cubeTimestamp: number | null;
}

export type SmartState =
  | { name: "needSolve" }
  | { name: "scrambling"; tracker: ScrambleTracker }
  /** Le mélange est fini mais le cube n'est pas dans l'état attendu. */
  | { name: "wrongState" }
  | { name: "inspecting"; startedAt: number }
  | { name: "waiting" }
  | { name: "running"; inspectionPenalty: Penalty; moves: TimedMove[] };

export interface SmartResult {
  timeMs: number;
  penalty: Penalty;
  scramble: string;
  moves: TimedMove[];
}

export class SmartSession {
  state: SmartState = { name: "needSolve" };
  private scramble = "";
  private target = SOLVED;

  constructor(
    private readonly options: {
      inspection: () => boolean;
      onFinish: (result: SmartResult) => void;
    },
  ) {}

  /** Nouveau mélange à appliquer. Sans effet pendant un solve. */
  setScramble(scramble: string, facelets: string | null): void {
    this.scramble = scramble;
    this.target = applyAlg(SOLVED, scramble);
    if (this.state.name === "running") return;
    this.restart(facelets);
  }

  /** Repart de zéro selon l'état du cube (annule une inspection ou un solve en cours). */
  restart(facelets: string | null): void {
    if (facelets && isSolved(facelets) && this.scramble) {
      this.state = { name: "scrambling", tracker: new ScrambleTracker(this.scramble) };
    } else {
      this.state = { name: "needSolve" };
    }
  }

  /** L'état du cube a été (re)lu sans mouvement (connexion, resynchronisation). */
  onSync(facelets: string): void {
    if (this.state.name === "needSolve" || this.state.name === "wrongState") this.restart(facelets);
  }

  /** @param facelets état du cube après ce mouvement */
  onMove(move: TimedMove, facelets: string): void {
    const s = this.state;
    switch (s.name) {
      case "needSolve":
      case "wrongState":
        if (isSolved(facelets)) this.restart(facelets);
        break;

      case "scrambling":
        // Revenu à résolu (l'utilisateur a tout défait) : on reprend le mélange au début.
        if (isSolved(facelets)) {
          this.restart(facelets);
          break;
        }
        s.tracker.apply(move.move);
        if (s.tracker.done) {
          if (facelets !== this.target) this.state = { name: "wrongState" };
          else if (this.options.inspection()) this.state = { name: "inspecting", startedAt: move.timestamp };
          else this.state = { name: "waiting" };
        }
        break;

      case "inspecting":
      case "waiting":
        this.state = {
          name: "running",
          inspectionPenalty: s.name === "inspecting" ? inspectionPenalty(s.startedAt, move.timestamp) : "none",
          moves: [move],
        };
        // (un cube ne peut pas être résolu en un seul mouvement depuis un mélange WCA)
        break;

      case "running":
        s.moves.push(move);
        if (isSolved(facelets)) {
          const result: SmartResult = {
            timeMs: solveDuration(s.moves),
            penalty: s.inspectionPenalty,
            scramble: this.scramble,
            moves: s.moves,
          };
          this.state = { name: "needSolve" };
          this.options.onFinish(result);
        }
        break;
    }
  }

  /** Temps écoulé du solve en cours (pour l'affichage). */
  elapsed(now: number): number | null {
    const s = this.state;
    if (s.name !== "running") return null;
    return now - s.moves[0].timestamp;
  }
}

/**
 * Durée du premier au dernier mouvement. On préfère l'horloge du cube (pas de latence
 * Bluetooth) quand elle est disponible pour les deux extrémités.
 */
export function solveDuration(moves: readonly TimedMove[]): number {
  const first = moves[0];
  const last = moves[moves.length - 1];
  if (first.cubeTimestamp != null && last.cubeTimestamp != null) {
    return last.cubeTimestamp - first.cubeTimestamp;
  }
  return last.timestamp - first.timestamp;
}
