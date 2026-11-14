// Enregistrement d'un algo fait sur le cube connecté (fiche d'un cas, « Ajouter mon algo ») :
// - on attend que le cube montre le cas (dernière couche en haut selon la tenue réglée, F2L faits) ;
// - on note les quarts de tour reçus, traduits dans le repère du joueur ;
// - revenir à l'état de départ remet l'enregistrement à zéro ;
// - dès que la dernière couche est résolue (à un AUF près, F2L intacts), c'est fini.
// Le cube ne voit que des tours de faces : r, M, x… ressortent en tours de faces.

import { CROSS_GROUPS, allSolved, applyAlg, formatTurn, parseAlg } from "./facelets";
import { caseKind, edgesOriented, isOriented, recognizePll, showsCaseState, type CaseDef } from "./cases";
import { mergeTurns, toPlayerView } from "./setup";
import { DEFAULT_HOLDING, holdingRotation, playerMove, type Holding } from "../training/warmup";

export type RecorderPhase = "waiting" | "recording" | "done";

export class AlgRecorder {
  phase: RecorderPhase = "waiting";
  /** État du cube (repère cube) au départ de l'enregistrement. */
  private start = "";
  /** Quarts de tour reçus, repère du joueur. */
  private moves: string[] = [];
  private readonly rotation: string;

  constructor(
    private readonly c: CaseDef,
    holding: Holding = DEFAULT_HOLDING,
  ) {
    this.rotation = holdingRotation(holding);
  }

  /** État vu par le joueur, tenu selon sa tenue. */
  private view(state: string): string {
    return applyAlg(toPlayerView(state), this.rotation);
  }

  private f2l(view: string): boolean {
    return allSolved(view, CROSS_GROUPS.D.f2l);
  }

  /** La dernière couche est-elle faite (selon le type de cas), F2L intacts ? */
  private solved(view: string): boolean {
    if (!this.f2l(view)) return false;
    const kind = caseKind(this.c);
    if (kind === "eo") return edgesOriented(view);
    if (kind === "oll") return isOriented(view);
    return isOriented(view) && recognizePll(view) === "skip";
  }

  /** Repart de zéro : on attend de nouveau que le cube montre le cas. */
  restart(state: string): void {
    this.phase = "waiting";
    this.moves = [];
    this.update(state);
  }

  /**
   * À appeler avec l'état du cube (repère cube) après chaque événement : `move` = quart
   * de tour reçu (absent pour un état recalé sans mouvement).
   */
  update(state: string, move?: string): void {
    if (this.phase === "done") return;
    const view = this.view(state);
    if (this.phase === "waiting") {
      if (this.f2l(view) && showsCaseState(view, this.c)) {
        this.phase = "recording";
        this.start = state;
        this.moves = [];
      }
      return;
    }
    if (move) this.moves.push(playerMove(move, this.rotation));
    if (state === this.start) this.moves = [];
    else if (this.moves.length > 0 && this.solved(view)) this.phase = "done";
  }

  /** Nombre de quarts de tour reçus. */
  get count(): number {
    return this.moves.length;
  }

  /**
   * Formule enregistrée : quarts de tour regroupés (R R → R2), allers-retours supprimés
   * (face qui hésite), AUF de départ retiré (la vérification accepte un AUF).
   */
  get alg(): string {
    const turns = mergeTurns(parseAlg(this.moves.join(" ")));
    if (this.phase === "done") while (turns.length > 0 && turns[0].face === "U") turns.shift();
    return turns.map(formatTurn).join(" ");
  }
}
