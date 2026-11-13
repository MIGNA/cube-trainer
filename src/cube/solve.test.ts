import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, isSolved } from "./facelets";
import { solutionFor } from "./solve";

describe("solutionFor", () => {
  it.each(["R U2 F' L D' B2 R' U F2 D L' B U2", "D", "R U R' U'", ""])("résout « %s »", async (scramble) => {
    const state = applyAlg(SOLVED, scramble);
    const moves = await solutionFor(state);
    expect(isSolved(applyAlg(state, moves))).toBe(true);
    expect(moves.split(" ").length).toBeLessThanOrEqual(25);
  });
});
