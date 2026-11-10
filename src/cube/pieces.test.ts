import { expect, it } from "vitest";
import { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { SOLVED, applyAlg } from "./facelets";
import { CORNERS, EDGES, readOrbit, writeOrbit } from "./pieces";

const ALGS = ["R", "U", "F", "D", "L", "B", "R U", "F R", "R U R' F' L2 D B'", "B2 L' D F U2 R' B L"];

it("la lecture des pièces correspond au format de cubing.js", async () => {
  const kpuzzle = await cube3x3x3.kpuzzle();
  for (const alg of ALGS) {
    const f = applyAlg(SOLVED, alg);
    const ref = kpuzzle.defaultPattern().applyAlg(alg);
    const p = new KPattern(kpuzzle, { EDGES: readOrbit(f, EDGES), CORNERS: readOrbit(f, CORNERS), CENTERS: ref.patternData.CENTERS });
    expect(p.isIdentical(ref), alg).toBe(true);
  }
}, 30_000);

it("writeOrbit est l'inverse de readOrbit", () => {
  for (const alg of ALGS) {
    const f = applyAlg(SOLVED, alg);
    const out = [...SOLVED];
    writeOrbit(out, EDGES, readOrbit(f, EDGES));
    writeOrbit(out, CORNERS, readOrbit(f, CORNERS));
    expect(out.join("")).toBe(f);
  }
});
