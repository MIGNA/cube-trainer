import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, applyMove } from "../cube/facelets";
import { PLL_CASES } from "../cube/cases";
import { suggestedAlgs } from "../cube/case-algs";
import { switchFrame } from "../cube/setup";
import { WarmupTracker, cubeMoves, drawWarmup, exerciseFor, expectedStates, moveProgress, moveWeights, triggerExercises, type PllChoice, type WarmupExercise } from "./warmup";

/** Rejoue un exercice sur un « cube connecté » et renvoie le suivi. */
function play(ex: WarmupExercise, start: string, extra: string[] = [], moves = cubeMoves(ex)): WarmupTracker {
  const tracker = new WarmupTracker(ex, start);
  feed(tracker, start, [...extra, ...moves]);
  return tracker;
}

/** Envoie des quarts de tour (repère cube) au suivi ; renvoie l'état final. */
function feed(tracker: WarmupTracker, start: string, moves: string[]): string {
  let state = start;
  let t = tracker.moves * 100;
  for (const m of moves) {
    state = applyMove(state, m);
    tracker.move(m, state, (t += 100));
  }
  return state;
}

const scrambled = applyAlg(SOLVED, "R U2 F' L D' B2 R' U F2 D L' B U2");

describe("échauffement", () => {
  it("12 triggers (main droite et gauche), chacun ×6", () => {
    const list = triggerExercises();
    expect(list).toHaveLength(12);
    for (const ex of list) expect(ex.reps, ex.label).toBe(6);
  });

  it("chaque PLL proposée se boucle en 4 répétitions au plus (AUF ajouté si besoin)", () => {
    for (const c of PLL_CASES) {
      for (const alg of suggestedAlgs(c)) {
        const ex = exerciseFor(alg);
        expect(ex, `${c.id} : ${alg}`).not.toBeNull();
        expect(ex!.reps, `${c.id} : ${alg}`).toBeLessThanOrEqual(4);
      }
    }
    expect(exerciseFor("R U R' U' R' F R2 U' R' U' R U R' F'")).toEqual({ alg: "R U R' U' R' F R2 U' R' U' R U R' F'", reps: 2 });
  });

  it("quarts de tour vus par le cube : R2 = 2, M = 2 faces, rotation = 0", () => {
    const ex = (alg: string): WarmupExercise => ({ kind: "pll", label: "", alg, reps: 1 });
    expect(cubeMoves(ex("R2 U"))).toHaveLength(3);
    expect(cubeMoves(ex("M2 U M2"))).toHaveLength(9);
    expect(cubeMoves(ex("y R"))).toHaveLength(1);
    expect(cubeMoves(ex("R U R' U'"))).toHaveLength(4); // un « prime » = un seul quart de tour
    expect(cubeMoves(ex("M'"))).toHaveLength(2);
    expect(triggerExercises().map((e) => cubeMoves(e).length / e.reps)).toEqual([8, 8, 8, 8, 4, 4, 4, 4, 4, 4, 4, 4]); // Sune/Anti-Sune : 8 (U2 = 2), les autres : 4
  });

  it("le dernier état attendu est le point de départ, même avec tranches et rotations", () => {
    for (const c of PLL_CASES) {
      const ex = { kind: "pll" as const, label: c.id, ...exerciseFor(c.alg)! };
      const states = expectedStates(scrambled, ex);
      expect(states.at(-1), c.id).toBe(scrambled);
      expect(new Set(states.slice(0, -1)).size, c.id).toBe(ex.reps);
    }
  });

  it("suivi : toutes les répétitions reconnues, sans erreur (H avec M2, V avec y, T)", () => {
    for (const id of ["H", "V", "T", "Ua", "Z"]) {
      const c = PLL_CASES.find((p) => p.id === id)!;
      const ex = { kind: "pll" as const, label: id, ...exerciseFor(c.alg)! };
      const tracker = play(ex, scrambled);
      expect(tracker.finished, id).toBe(true);
      expect(tracker.extraMoves, id).toBe(0);
      expect(tracker.moves, id).toBe(tracker.expectedMoves);
    }
  });

  it("suivi : les mouvements en trop comptent comme erreurs", () => {
    const sexy = triggerExercises()[4];
    expect(sexy.alg).toBe("R U R' U'");
    const tracker = play(sexy, SOLVED, ["F", "F'"]);
    expect(tracker.finished).toBe(true);
    expect(tracker.extraMoves).toBe(2);
    expect(tracker.finishedAt! - tracker.firstMoveAt!).toBe(100 * (tracker.moves - 1));
  });

  describe("tirage", () => {
    const pll = (id: string, status: PllChoice["status"]): PllChoice => ({ id, status, alg: PLL_CASES.find((c) => c.id === id)!.alg });
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    it("3 triggers d'abord, puis 5 PLL, les maîtrisées en priorité", () => {
      const plls = [...["T", "Ja", "Jb", "Ua", "Ub", "H"].map((id) => pll(id, "known")), ...["V", "Y", "Na"].map((id) => pll(id, "learning"))];
      const draw = drawWarmup(plls, random);
      expect(draw.map((e) => e.kind)).toEqual(["trigger", "trigger", "trigger", "pll", "pll", "pll", "pll", "pll"]);
      for (const e of draw.slice(3)) expect(["T", "Ja", "Jb", "Ua", "Ub", "H"].map((id) => `${id}-perm`)).toContain(e.label);
    });

    it("complète avec les PLL à travailler, ou triggers seuls s'il n'y a rien", () => {
      expect(drawWarmup([pll("T", "known"), pll("Y", "learning")], random).filter((e) => e.kind === "pll")).toHaveLength(2);
      expect(drawWarmup([], random).map((e) => e.kind)).toEqual(["trigger", "trigger", "trigger"]);
    });
  });

  describe("suivi mouvement par mouvement", () => {
    const sexy = (): WarmupExercise => triggerExercises()[4];
    const pllEx = (id: string): WarmupExercise => ({ kind: "pll", label: id, ...exerciseFor(PLL_CASES.find((c) => c.id === id)!.alg)! });

    it("on peut tenir le cube comme on veut (ici blanc en haut, Sune gauche)", () => {
      const ex = triggerExercises()[1];
      expect(ex.label).toBe("Sune (main gauche)");
      // Blanc en haut : le cube voit les lettres de la formule telles quelles.
      const literal = cubeMoves(ex).map(switchFrame);
      const tracker = play(ex, scrambled, [], literal);
      expect(tracker.finished).toBe(true);
      expect(tracker.extraMoves).toBe(0);
    });

    it("tranche M : les deux faces peuvent arriver dans n'importe quel ordre", () => {
      const ex = pllEx("H");
      const moves = cubeMoves(ex);
      // Inverse l'ordre de chaque paire de faces opposées consécutives (R L' → L' R).
      const opposite: Record<string, string> = { R: "L", L: "R", U: "D", D: "U", F: "B", B: "F" };
      const swapped = [...moves];
      for (let i = 0; i + 1 < swapped.length; i += 2) {
        if (opposite[swapped[i][0]] === swapped[i + 1][0]) [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      }
      expect(swapped).not.toEqual(moves);
      const tracker = play(ex, scrambled, [], swapped);
      expect(tracker.finished).toBe(true);
      expect(tracker.extraMoves).toBe(0);
    });

    it("écart : on dit quoi défaire, puis le suivi reprend", () => {
      const ex = sexy();
      const tracker = new WarmupTracker(ex, SOLVED);
      const moves = cubeMoves(ex);
      let state = feed(tracker, SOLVED, moves.slice(0, 2));
      expect(tracker.pos).toBe(2);
      state = feed(tracker, state, ["F"]); // erreur
      expect(tracker.lost).toBe(true);
      expect(tracker.corrections()).toEqual(["F'"]);
      state = feed(tracker, state, ["F'"]);
      expect(tracker.lost).toBe(false);
      expect(tracker.pos).toBe(2);
      feed(tracker, state, moves.slice(2));
      expect(tracker.finished).toBe(true);
      expect(tracker.extraMoves).toBe(2);
    });

    it("A-perm (rotations x) : répétitions comptées une par une", () => {
      const ex = pllEx("Aa");
      const tracker = new WarmupTracker(ex, scrambled);
      const moves = cubeMoves(ex);
      let state = scrambled;
      const reps: number[] = [];
      for (const m of moves) {
        state = feed(tracker, state, [m]);
        reps.push(tracker.done);
      }
      expect(reps.filter((d, i) => i === 0 || d !== reps[i - 1])).toEqual([0, 1, 2, 3]);
    });

    it("formule allumée au fil des mouvements (rotation faite dès le mouvement suivant)", () => {
      const w = moveWeights("x R' U R' D2");
      expect(w).toEqual([0, 1, 1, 1, 2]);
      expect(moveProgress(w, 0)).toEqual(["current", "todo", "todo", "todo", "todo"]);
      expect(moveProgress(w, 1)).toEqual(["done", "done", "current", "todo", "todo"]);
      expect(moveProgress(w, 4)).toEqual(["done", "done", "done", "done", "current"]);
      expect(moveProgress(w, 5)).toEqual(["done", "done", "done", "done", "done"]);
      expect(moveWeights("(R U R' U')")).toEqual([1, 1, 1, 1]);
    });
  });
});
