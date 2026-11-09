import { expect, it } from "vitest";
import { randomScrambleForEvent } from "cubing/scramble";
import { SOLVED, applyAlg, invertAlg, isSolved, isValidFacelets } from "./facelets";

it("les mélanges cubing.js sont compris par le modèle", async () => {
  for (let i = 0; i < 3; i++) {
    const scramble = (await randomScrambleForEvent("333")).toString();
    const state = applyAlg(SOLVED, scramble);
    expect(isValidFacelets(state)).toBe(true);
    expect(isSolved(state)).toBe(false);
    expect(applyAlg(state, invertAlg(scramble))).toBe(SOLVED);
  }
}, 30_000);
