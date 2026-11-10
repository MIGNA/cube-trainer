import { describe, expect, it } from "vitest";
import { EO_CASES, OLL_CASES, PLL_CASES, edgesOriented, eoSignature, isOriented, ollSignature, pllSignature, recognizeEo, recognizeOll, recognizePll } from "./cases";
import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, invertAlg, isSolved } from "./facelets";

const caseState = (alg: string) => applyAlg(SOLVED, invertAlg(alg));
const f2lDone = (f: string) => allSolved(f, CROSS_GROUPS.D.f2l);

describe("table OLL", () => {
  it("contient 57 cas avec des identifiants uniques", () => {
    expect(OLL_CASES).toHaveLength(57);
    expect(new Set(OLL_CASES.map((c) => c.id)).size).toBe(57);
  });

  it.each(OLL_CASES)("$id : l'algo préserve les F2L et oriente la dernière couche", ({ alg }) => {
    const state = caseState(alg);
    expect(f2lDone(state)).toBe(true);
    expect(isOriented(state)).toBe(false);
    expect(isOriented(applyAlg(state, alg))).toBe(true);
  });

  it("les 57 cas sont tous différents (à rotation près)", () => {
    const sigs = OLL_CASES.map((c) => ollSignature(caseState(c.alg)));
    expect(new Set(sigs).size).toBe(57);
  });

  it("reconnaît un cas quelle que soit la rotation de la couche U", () => {
    const sune = OLL_CASES.find((c) => c.id === "OLL 27")!;
    for (const auf of ["", "U", "U2", "U'"]) {
      expect(recognizeOll(applyAlg(caseState(sune.alg), auf))).toBe(sune);
    }
  });

  it("skip si la dernière couche est déjà orientée", () => {
    expect(recognizeOll(caseState(PLL_CASES[0].alg))).toBe("skip");
  });
});

describe("table PLL", () => {
  it("contient 21 cas avec des identifiants uniques", () => {
    expect(PLL_CASES).toHaveLength(21);
    expect(new Set(PLL_CASES.map((c) => c.id)).size).toBe(21);
  });

  it.each(PLL_CASES)("$id : préserve F2L + orientation et résout le cube (à un AUF près)", ({ alg }) => {
    const state = caseState(alg);
    expect(f2lDone(state)).toBe(true);
    expect(isOriented(state)).toBe(true);
    expect(isSolved(state)).toBe(false);
    const after = applyAlg(state, alg);
    expect(["", "U", "U2", "U'"].some((auf) => isSolved(applyAlg(after, auf)))).toBe(true);
  });

  it("les 21 cas sont tous différents (à AUF et rotation près)", () => {
    const sigs = PLL_CASES.map((c) => pllSignature(caseState(c.alg)));
    expect(new Set(sigs).size).toBe(21);
  });

  it("reconnaît un cas avec AUF avant et après", () => {
    const t = PLL_CASES.find((c) => c.id === "T")!;
    for (const pre of ["", "U", "U2", "U'"]) {
      for (const post of ["", "U", "U'"]) {
        const state = applyAlg(SOLVED, `${post} ${invertAlg(t.alg)} ${pre}`.trim());
        expect(recognizePll(state)).toBe(t);
      }
    }
  });

  it("skip si la dernière couche est résolue à un AUF près", () => {
    expect(recognizePll(SOLVED)).toBe("skip");
    expect(recognizePll(applyAlg(SOLVED, "U"))).toBe("skip");
  });
});

describe("croix du 2-look", () => {
  it.each(EO_CASES)("$id : l'algo préserve les F2L et oriente les arêtes", ({ alg }) => {
    const solved = applyAlg(caseState(alg), alg);
    expect(f2lDone(solved)).toBe(true);
    expect(edgesOriented(solved)).toBe(true);
    expect(edgesOriented(caseState(alg))).toBe(false);
  });

  it("les 3 cas sont distincts", () => {
    expect(new Set(EO_CASES.map((c) => eoSignature(caseState(c.alg)))).size).toBe(3);
  });

  it("reconnaît le cas quels que soient les coins et l'AUF", () => {
    // OLL 2 (point), OLL 44 (P → L), OLL 45 (T → ligne), vus sous un autre angle.
    const ids = ["OLL 2", "OLL 44", "OLL 45"].map((id) => OLL_CASES.find((c) => c.id === id)!);
    ids.forEach((c, i) => expect(recognizeEo(applyAlg(caseState(c.alg), "U"))).toBe(EO_CASES[i]));
    expect(recognizeEo(caseState(OLL_CASES.find((c) => c.id === "OLL 27")!.alg))).toBe("skip");
  });
});
