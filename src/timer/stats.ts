// Calculs statistiques selon les règles WCA.
// Convention : Infinity représente un DNF, null une valeur indisponible.

import type { Penalty } from "../storage/db";

export interface Timed {
  timeMs: number;
  penalty: Penalty;
}

/** Temps retenu d'un solve : +2 ajoute 2 s, DNF = Infinity. */
export function effectiveTime(solve: Timed): number {
  if (solve.penalty === "DNF") return Infinity;
  if (solve.penalty === "+2") return solve.timeMs + 2000;
  return solve.timeMs;
}

/** Nombre de temps retirés de chaque côté pour une moyenne de n (5 % arrondi au supérieur, comme cstimer). */
export function trimCount(n: number): number {
  return Math.ceil(n * 0.05);
}

/**
 * Moyenne WCA des `n` derniers solves (ao5, ao12…) : on retire les meilleurs et pires temps,
 * puis on fait la moyenne du reste. Trop de DNF (plus que le nombre retiré) → DNF.
 * @param solves du plus ancien au plus récent
 */
export function averageOf(solves: readonly Timed[], n: number): number | null {
  if (solves.length < n) return null;
  const times = solves.slice(-n).map(effectiveTime).sort((a, b) => a - b);
  const trim = trimCount(n);
  const kept = times.slice(trim, n - trim);
  if (kept.some((t) => t === Infinity)) return Infinity;
  return kept.reduce((sum, t) => sum + t, 0) / kept.length;
}

/** Moyenne simple (sans retirer de temps). DNF si un des temps est DNF. */
export function meanOf(solves: readonly Timed[]): number | null {
  if (solves.length === 0) return null;
  const times = solves.map(effectiveTime);
  if (times.includes(Infinity)) return Infinity;
  return times.reduce((sum, t) => sum + t, 0) / times.length;
}

export function bestSingle(solves: readonly Timed[]): number | null {
  if (solves.length === 0) return null;
  return Math.min(...solves.map(effectiveTime));
}

/** Meilleure moyenne glissante de n sur tout l'historique. */
export function bestAverage(solves: readonly Timed[], n: number): number | null {
  let best: number | null = null;
  for (let end = n; end <= solves.length; end++) {
    const avg = averageOf(solves.slice(end - n, end), n);
    if (avg != null && (best == null || avg < best)) best = avg;
  }
  return best;
}

/** Moyenne de n se terminant à chaque solve (null tant qu'il n'y a pas assez de solves). */
export function rollingAverages(solves: readonly Timed[], n: number): (number | null)[] {
  return solves.map((_, i) => (i + 1 < n ? null : averageOf(solves.slice(i + 1 - n, i + 1), n)));
}
