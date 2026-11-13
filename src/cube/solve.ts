// Solution depuis l'état du cube connecté (bouton « Résoudre »).

import { applyAlg, formatTurn, isSolved, parseAlg } from "./facelets";
import { mergeTurns, setupFromState } from "./setup";

/** Mouvements (repère cube) qui résolvent l'état `current` (repère cube). */
export async function solutionFor(current: string): Promise<string> {
  const moves = await setupFromState(current, "");
  // Le calcul est fait « à un tour de la face jaune près » : on ajoute ce tour si besoin.
  const after = applyAlg(current, moves);
  const d = ["", "D", "D2", "D'"].find((x) => isSolved(x ? applyAlg(after, x) : after)) ?? "";
  return mergeTurns(parseAlg(`${moves} ${d}`.trim())).map(formatTurn).join(" ");
}
