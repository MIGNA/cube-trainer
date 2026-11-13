import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, applyMove } from "../cube/facelets";
import { PLL_CASES } from "../cube/cases";
import { suggestedAlgs } from "../cube/case-algs";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { DEFAULT_HOLDING, WarmupTracker, cubeMoves, drawWarmup, exerciseFor, frontChoices, holdingRotation, expectedStates, moveProgress, moveWeights, triggerExercises, type PllChoice, type WarmupExercise } from "./warmup";

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

  it("chaque PLL proposée se boucle en 4 répétitions au plus, formule telle quelle (retour à la tenue de départ)", () => {
    for (const c of PLL_CASES) {
      for (const alg of suggestedAlgs(c)) {
        const ex = exerciseFor(alg);
        expect(ex, `${c.id} : ${alg}`).not.toBeNull();
        expect(ex!.reps, `${c.id} : ${alg}`).toBeLessThanOrEqual(4);
        expect(ex!.alg).toBe(alg);
        expect(ex!.extra ?? "", `${c.id} : ${alg}`).not.toMatch(/U/); // jamais d'AUF ajouté
      }
    }
    expect(exerciseFor("R U R' U' R' F R2 U' R' U' R U R' F'")).toEqual({ alg: "R U R' U' R' F R2 U' R' U' R U R' F'", reps: 2 });
    // V-perm avec y : on reprend le cube vert devant (y') → ×2.
    expect(exerciseFor("R' U R' U' y R' F' R2 U' R' U R' F R F")).toEqual({ alg: "R' U R' U' y R' F' R2 U' R' U R' F R F", reps: 2, extra: "y'" });
    expect(exerciseFor("M' U M2 U M2 U M' U2 M2")?.reps).toBe(4); // Z : pas de U ajouté
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

    it("au plus un trigger main gauche par séance", () => {
      let lefts = 0;
      for (let i = 0; i < 200; i++) {
        const n = drawWarmup([], random).filter((e) => e.left).length;
        expect(n).toBeLessThanOrEqual(1);
        lefts += n;
      }
      expect(lefts).toBeGreaterThan(0); // la main gauche sort quand même de temps en temps
    });

    it("complète avec les PLL à travailler, ou triggers seuls s'il n'y a rien", () => {
      expect(drawWarmup([pll("T", "known"), pll("Y", "learning")], random).filter((e) => e.kind === "pll")).toHaveLength(2);
      expect(drawWarmup([], random).map((e) => e.kind)).toEqual(["trigger", "trigger", "trigger"]);
    });
  });

  describe("suivi mouvement par mouvement", () => {
    const sexy = (): WarmupExercise => triggerExercises()[4];
    const pllEx = (id: string): WarmupExercise => ({ kind: "pll", label: id, ...exerciseFor(PLL_CASES.find((c) => c.id === id)!.alg)! });

    it("tenue choisie : rotation depuis jaune en haut, vert devant", () => {
      expect(holdingRotation(DEFAULT_HOLDING)).toBe("");
      expect(holdingRotation({ up: "U", front: "R" })).toBe("y");
      expect(holdingRotation({ up: "F", front: "D" })).toBe("x");
      expect(frontChoices("D")).toEqual(["F", "R", "B", "L"]);
      for (const up of ["U", "R", "F", "D", "L", "B"] as const) for (const front of frontChoices(up)) expect(() => holdingRotation({ up, front })).not.toThrow();
    });

    it("la tenue est imposée : blanc en haut (vert devant), le cube voit les lettres telles quelles", () => {
      const ex = triggerExercises()[1];
      expect(ex.label).toBe("Sune (main gauche)");
      const literal = cubeMoves(ex).map(switchFrame);
      // Blanc en haut, vert devant = repère du cube GAN.
      const tracker = new WarmupTracker(ex, scrambled, { up: "D", front: "F" });
      feed(tracker, scrambled, literal);
      expect(tracker.finished).toBe(true);
      expect(tracker.extraMoves).toBe(0);
      // Avec la tenue par défaut (jaune en haut), les mêmes mouvements sont des écarts.
      const wrong = new WarmupTracker(ex, scrambled);
      feed(wrong, scrambled, literal.slice(0, 3));
      expect(wrong.lost).toBe(true);
      expect(wrong.corrections()).not.toBeNull();
    });

    it("tenue jaune en haut, rouge devant : formule suivie, corrections dans le repère du joueur", () => {
      const ex = sexy();
      const holding = { up: "U", front: "L" } as const;
      const moves = physicalQuarters(`${holdingRotation(holding)} ${ex.alg} ${ex.alg}`).map(switchFrame);
      const tracker = new WarmupTracker(ex, SOLVED, holding);
      let state = feed(tracker, SOLVED, moves.slice(0, 2));
      expect(tracker.pos).toBe(2);
      const fCube = switchFrame(physicalQuarters(`${holdingRotation(holding)} F`)[0]);
      state = feed(tracker, state, [fCube]);
      expect(tracker.corrections()).toEqual(["F'"]);
    });

    it.each(["H", "Ua", "Ub", "Z"])("tranche M (%s) : les deux faces dans n'importe quel ordre, jamais « perdu »", (id) => {
      const ex = pllEx(id);
      const moves = cubeMoves(ex);
      // Inverse l'ordre de chaque paire de faces opposées consécutives (R L' → L' R).
      const opposite: Record<string, string> = { R: "L", L: "R", U: "D", D: "U", F: "B", B: "F" };
      const swapped = [...moves];
      for (let i = 0; i + 1 < swapped.length; i += 2) {
        if (opposite[swapped[i][0]] === swapped[i + 1][0]) [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
      }
      expect(swapped).not.toEqual(moves);
      const tracker = new WarmupTracker(ex, scrambled);
      let state = scrambled;
      for (const m of swapped) {
        state = feed(tracker, state, [m]);
        expect(tracker.lost, `${id} après ${m}`).toBe(false);
      }
      expect(tracker.finished).toBe(true);
      expect(tracker.extraMoves).toBe(0);
    });

    it("faces opposées (M2, M', U2…) dans n'importe quel ordre et sens, sur toutes les PLL", () => {
      const axis: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (const c of PLL_CASES) {
        const ex = pllEx(c.id);
        const blocks: string[][] = [];
        const perRep = cubeMoves(ex).length / ex.reps;
        cubeMoves(ex).forEach((m, i) => {
          const last = blocks.at(-1);
          if (last && i % perRep !== 0 && axis[last[0][0]] === axis[m[0]]) last.push(m);
          else blocks.push([m]);
        });
        for (let trial = 0; trial < 20; trial++) {
          // Chaque face du bloc : ses quarts de tour (demi-tour dans un sens au hasard), puis ordre mélangé.
          const seq = blocks.flatMap((b) => {
            const qs = [...new Set(b.map((m) => m[0]))].flatMap((f) => {
              const own = b.filter((m) => m[0] === f);
              if (own.length % 2 || own.some((m, i) => m !== own[i ^ 1])) return own; // pas que des demi-tours
              // Demi-tours : chacun dans un sens au hasard.
              return Array.from({ length: own.length / 2 }, () => (rnd() < 0.5 ? [f, f] : [`${f}'`, `${f}'`])).flat();
            });
            for (let i = qs.length - 1; i > 0; i--) {
              const j = Math.floor(rnd() * (i + 1));
              [qs[i], qs[j]] = [qs[j], qs[i]];
            }
            return qs;
          });
          const tracker = new WarmupTracker(ex, scrambled);
          let state = scrambled;
          for (const m of seq) {
            state = feed(tracker, state, [m]);
            expect(tracker.lost, `${c.id} : ${seq.join(" ")}`).toBe(false);
          }
          expect(tracker.finished, `${c.id} : ${seq.join(" ")}`).toBe(true);
        }
      }
    });

    it("Z-perm : M2 fait en deux quarts du même côté d'abord", () => {
      const ex = pllEx("Z");
      const tracker = new WarmupTracker(ex, scrambled);
      // M' (R L'), U (devenu F), puis M2 en L L R' R' au lieu de L R' L R'.
      let state = feed(tracker, scrambled, ["R", "L'", "F", "L", "L"]);
      expect(tracker.lost).toBe(false);
      state = feed(tracker, state, ["R'", "R'"]);
      expect(tracker.pos).toBe(7);
      expect(tracker.lost).toBe(false);
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

    it("Sune : pas de saut à la répétition suivante sur le U2, et U2 fait en U' U' accepté", () => {
      const ex = triggerExercises()[0];
      expect(ex.alg).toBe("R U R' U R U2 R'");
      // Jaune en haut : R → L, U → D (repère cube).
      for (const half of [["D", "D"], ["D'", "D'"]]) {
        const tracker = new WarmupTracker(ex, scrambled);
        let state = feed(tracker, scrambled, ["L", "D", "L'", "D", "L"]);
        expect(tracker.pos).toBe(5);
        state = feed(tracker, state, [half[0]]);
        expect(tracker.lost, half.join(" ")).toBe(false);
        expect(tracker.pos).toBeLessThanOrEqual(6);
        state = feed(tracker, state, [half[1]]);
        expect(tracker.pos, half.join(" ")).toBe(7);
        feed(tracker, state, ["L'"]);
        expect(tracker.pos).toBe(8);
        expect(tracker.done).toBe(1);
      }
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
