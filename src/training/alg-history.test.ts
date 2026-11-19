import { describe, expect, it } from "vitest";
import type { SolveAnalysis, StepSplit } from "../cube/cfop";
import type { Solve, TrainingSession } from "../storage/db";
import { caseStats, passesFromSession, passesFromSolve, type AlgPass } from "./alg-history";

const step = (id: StepSplit["id"], recognitionMs: number, executionMs: number): StepSplit => ({
  id,
  moves: 10,
  endMs: 0,
  durationMs: recognitionMs + executionMs,
  recognitionMs,
  executionMs,
  tps: null,
});

const analysis = (oll: string | null, pll: string | null): SolveAnalysis => ({
  crossFace: "D",
  steps: [step("cross", 0, 2000), step("oll", 400, 1100), step("pll", 600, 1500)],
  totalMs: 5600,
  totalMoves: 50,
  tps: null,
  oll,
  pll,
});

const solve: Solve = { id: 7, date: 1000, timeMs: 5600, penalty: "none", scramble: "", source: "cube" };

describe("historique des temps par cas", () => {
  it("un solve donne ses passages OLL et PLL (reconnaissance et exécution séparées)", () => {
    expect(passesFromSolve(solve, analysis("OLL 27", "Jb"))).toEqual([
      { caseId: "OLL 27", date: 1000, source: "solve", execMs: 1100, recoMs: 400, solveId: 7 },
      { caseId: "Jb", date: 1000, source: "solve", execMs: 1500, recoMs: 600, solveId: 7 },
    ]);
  });

  it("cas sautés ou non reconnus ignorés", () => {
    expect(passesFromSolve(solve, analysis("skip", null))).toEqual([]);
  });

  it("échauffement : PLL seulement, temps d'une répétition, erreurs si mouvements en trop", () => {
    const session: TrainingSession = {
      date: 2000,
      kind: "warmup",
      items: [
        { label: "Sexy move", alg: "R U R' U'", reps: 6, timeMs: 3000, connected: true, expectedMoves: 24, moves: 24 },
        { label: "T-perm", alg: "…", reps: 2, timeMs: 3000, connected: true, expectedMoves: 28, moves: 30 },
        { label: "Ua-perm", alg: "…", reps: 3, timeMs: 0, connected: false, expectedMoves: 30, skipped: true },
        { label: "Z-perm", alg: "…", reps: 4, timeMs: 8000, connected: false, expectedMoves: 48 },
      ],
    };
    expect(passesFromSession(session)).toEqual([
      { caseId: "T", date: 2000, source: "warmup", execMs: 1500, errors: true },
      { caseId: "Z", date: 2000, source: "warmup", execMs: 2000 },
    ]);
  });

  it("Toutes mes PLL : un passage par PLL faite ; les anciennes séances sans détail ne donnent rien", () => {
    const base = { date: 3000, kind: "pll-run" as const, items: [] };
    expect(passesFromSession(base)).toEqual([]);
    expect(
      passesFromSession({
        ...base,
        passes: [
          { id: "T", timeMs: 1200, moves: 14, extra: 0 },
          { id: "T", moves: 16, extra: 2 },
        ],
      }),
    ).toEqual([
      { caseId: "T", date: 3000, source: "pll-run", execMs: 1200, errors: false },
      { caseId: "T", date: 3000, source: "pll-run", execMs: null, errors: true },
    ]);
  });

  it("statistiques : moyenne des 12 derniers sans erreur, meilleur, erreurs", () => {
    const passes: AlgPass[] = [
      ...Array.from({ length: 14 }, (_, i): AlgPass => ({ caseId: "T", date: i, source: "solve", execMs: 1000 + i * 100, recoMs: 500 })),
      { caseId: "T", date: 20, source: "pll-run", execMs: 900, errors: false },
      { caseId: "T", date: 21, source: "pll-run", execMs: 400, errors: true },
    ];
    const [solves, run] = caseStats(passes);
    expect(solves).toMatchObject({ source: "solve", count: 14, recentCount: 12, bestMs: 1000, recentRecoMs: 500, errors: null });
    // 12 derniers : i = 2 … 13
    expect(solves.recentMs).toBeCloseTo(1000 + 7.5 * 100);
    // Le passage raté (400 ms) ne compte ni dans la moyenne ni dans le meilleur.
    expect(run).toMatchObject({ source: "pll-run", count: 2, recentMs: 900, bestMs: 900, errors: { bad: 1, known: 2 } });
  });
});
