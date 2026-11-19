// Historique des temps par cas (OLL / PLL) : chaque fois qu'un cas est fait, en solve ou en
// exercice, c'est un « passage ». Rien n'est stocké à part : les passages sont retrouvés
// dans les solves (analyse CFOP, mouvements enregistrés) et dans les séances d'entraînement.
// Logique pure ; l'affichage est dans ui/case-times.ts.

import type { SolveAnalysis } from "../cube/cfop";
import type { Solve, TrainingSession } from "../storage/db";

export type PassSource = "solve" | "warmup" | "pll-run";

export const SOURCE_LABELS: Record<PassSource, string> = {
  solve: "Solves",
  warmup: "Échauffement",
  "pll-run": "Toutes mes PLL",
};

export interface AlgPass {
  caseId: string;
  date: number;
  source: PassSource;
  /** Temps d'exécution (ms) ; échauffement = moyenne des répétitions de l'exercice. null = inconnu. */
  execMs: number | null;
  /** Temps de reconnaissance (solves seulement). */
  recoMs?: number;
  /** Mouvements en trop par rapport à la formule (exercices avec le cube) ; absent = inconnu. */
  errors?: boolean;
  /** Solve d'origine (lien vers son analyse). */
  solveId?: number;
}

/** Passages OLL / PLL d'un solve analysé (cas sautés ou non reconnus ignorés). */
export function passesFromSolve(solve: Solve, analysis: SolveAnalysis): AlgPass[] {
  const out: AlgPass[] = [];
  for (const [stepId, result] of [
    ["oll", analysis.oll],
    ["pll", analysis.pll],
  ] as const) {
    if (!result || result === "skip") continue;
    const step = analysis.steps.find((s) => s.id === stepId);
    if (!step) continue;
    out.push({
      caseId: result,
      date: solve.date,
      source: "solve",
      execMs: step.executionMs,
      recoMs: step.recognitionMs,
      ...(solve.id !== undefined ? { solveId: solve.id } : {}),
    });
  }
  return out;
}

/** Passages d'une séance d'entraînement (PLL seulement : les triggers ne sont pas des cas). */
export function passesFromSession(session: TrainingSession): AlgPass[] {
  if (session.kind === "pll-run") {
    // Séances enregistrées avant le détail par passage : rien d'exploitable.
    return (session.passes ?? []).map((p) => ({
      caseId: p.id,
      date: session.date,
      source: "pll-run" as const,
      execMs: p.timeMs ?? null,
      errors: p.extra > 0,
    }));
  }
  return session.items.flatMap((item) => {
    const id = /^(.+)-perm$/.exec(item.label)?.[1];
    if (!id || item.skipped || item.reps <= 0) return [];
    return [
      {
        caseId: id,
        date: session.date,
        source: "warmup" as const,
        execMs: item.timeMs > 0 ? item.timeMs / item.reps : null,
        ...(item.connected && item.moves !== undefined ? { errors: item.moves > item.expectedMoves } : {}),
      },
    ];
  });
}

export interface SourceStats {
  source: PassSource;
  count: number;
  /** Moyenne des RECENT derniers temps (passages sans erreur), null si aucun. */
  recentMs: number | null;
  /** Nombre de temps dans cette moyenne. */
  recentCount: number;
  bestMs: number | null;
  /** Reconnaissance moyenne sur les mêmes passages (solves). */
  recentRecoMs: number | null;
  /** Passages avec erreurs / passages dont on sait s'il y en a eu (null si aucun). */
  errors: { bad: number; known: number } | null;
}

export const RECENT = 12;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Statistiques par situation, dans l'ordre solves / échauffement / Toutes mes PLL. */
export function caseStats(passes: readonly AlgPass[]): SourceStats[] {
  return (Object.keys(SOURCE_LABELS) as PassSource[]).flatMap((source) => {
    const list = passes.filter((p) => p.source === source).sort((a, b) => a.date - b.date);
    if (list.length === 0) return [];
    // Les temps avec erreurs ne disent rien de la vitesse : on ne les compte pas.
    const timed = list.filter((p) => p.execMs !== null && !p.errors);
    const recent = timed.slice(-RECENT);
    const known = list.filter((p) => p.errors !== undefined);
    const recos = recent.flatMap((p) => (p.recoMs !== undefined ? [p.recoMs] : []));
    return [
      {
        source,
        count: list.length,
        recentMs: mean(recent.map((p) => p.execMs!)),
        recentCount: recent.length,
        bestMs: timed.length ? Math.min(...timed.map((p) => p.execMs!)) : null,
        recentRecoMs: mean(recos),
        errors: known.length ? { bad: known.filter((p) => p.errors).length, known: known.length } : null,
      },
    ];
  });
}
