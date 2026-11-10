import { describe, expect, it } from "vitest";
import { analyzeSolve } from "./cfop";
import { FACES, SOLVED, applyAlg, invertAlg, isSolved } from "./facelets";
import { faceMapForCross, fluency, mergeTurns, phases, reconstructSteps, relabelMoves, setupForCross } from "./reconstruction";

const at = (ms: number[]) => ms.map((t) => ({ m: "R", t }));

describe("mergeTurns", () => {
  it("regroupe les quarts de tour d'une même face", () => {
    expect(mergeTurns(["R", "R", "U", "U'", "F"])).toEqual(["R2", "F"]);
    expect(mergeTurns(["R", "R", "R"])).toEqual(["R'"]);
    expect(mergeTurns(["R'", "R'"])).toEqual(["R2"]);
    expect(mergeTurns(["R", "R'", "U"])).toEqual(["U"]);
    expect(mergeTurns([])).toEqual([]);
  });
});

describe("repère croix en bas", () => {
  it("croix sur D : rien ne change", () => {
    for (const f of FACES) expect(faceMapForCross("D")[f]).toBe(f);
  });

  it("croix sur U : U↔D et F↔B", () => {
    expect(faceMapForCross("U")).toMatchObject({ U: "D", D: "U", F: "B", B: "F", R: "R", L: "L" });
  });

  it("pour chaque face : mélange recadré + solution renommée = cube résolu", () => {
    const scramble = "R U2 F' L D B2 R' U";
    const solution = invertAlg(scramble).split(" ").flatMap((m) => (m.endsWith("2") ? [m[0], m[0]] : [m]));
    for (const face of FACES) {
      const setup = setupForCross(scramble, face);
      const moves = relabelMoves(solution, faceMapForCross(face));
      expect(isSolved(applyAlg(SOLVED, `${setup} ${moves.join(" ")}`))).toBe(true);
    }
  });
});

describe("fluency", () => {
  it("100 % sans pause, et les pauses de plus de 500 ms sont retirées", () => {
    expect(fluency(at([0, 100, 200]))).toBe(1);
    expect(fluency(at([0, 100, 1100]))).toBeCloseTo(1 - 1000 / 1100);
    expect(fluency(at([0]))).toBeNull();
  });
});

describe("reconstructSteps / phases", () => {
  it("découpe la solution par étape et regroupe les blocs", () => {
    const solution = ["R", "U'", "R'"]; // dernière paire F2L
    const moves = solution.map((m, i) => ({ m, t: i * 100 }));
    const a = analyzeSolve(invertAlg(solution.join(" ")), moves)!;
    const steps = reconstructSteps(a, moves);
    expect(steps.find((s) => s.id === "f2l4")!.moves).toEqual(["R", "U'", "R'"]);
    expect(steps.filter((s) => s.moves.length).length).toBe(1);
    expect(phases(a).map((p) => p.id)).toEqual(["cross", "f2l", "oll", "pll"]);
    expect(phases(a).reduce((s, p) => s + p.durationMs, 0)).toBe(a.totalMs);
  });
});
