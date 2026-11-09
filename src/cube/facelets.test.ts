import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, applyMove, invertAlg, isSolved, isValidFacelets, parseMove } from "./facelets";

const face = (facelets: string, f: number) => facelets.slice(f * 9, f * 9 + 9);
// Ordre des faces : U R F D L B
const [U, R, F, D, L, B] = [0, 1, 2, 3, 4, 5];

describe("mouvements de base", () => {
  it("R sur un cube résolu : F monte sur U, U part sur B", () => {
    const s = applyMove(SOLVED, "R");
    expect(face(s, U)).toBe("UUFUUFUUF");
    expect(face(s, F)).toBe("FFDFFDFFD");
    expect(face(s, D)).toBe("DDBDDBDDB");
    // Sur B (vu de dos), la colonne gauche est côté R
    expect(face(s, B)).toBe("UBBUBBUBB");
    expect(face(s, R)).toBe("RRRRRRRRR");
    expect(face(s, L)).toBe("LLLLLLLLL");
  });

  it("U sur un cube résolu : F part à gauche (sur L)", () => {
    const s = applyMove(SOLVED, "U");
    expect(face(s, L).slice(0, 3)).toBe("FFF");
    expect(face(s, F).slice(0, 3)).toBe("RRR");
    expect(face(s, R).slice(0, 3)).toBe("BBB");
    expect(face(s, B).slice(0, 3)).toBe("LLL");
    expect(face(s, U)).toBe("UUUUUUUUU");
  });

  it("F sur un cube résolu : U descend sur R", () => {
    const s = applyMove(SOLVED, "F");
    // colonne gauche de R (côté F) devient U
    expect([0, 3, 6].map((i) => face(s, R)[i]).join("")).toBe("UUU");
    // ligne du bas de U devient L
    expect(face(s, U).slice(6)).toBe("LLL");
  });

  it("chaque face tournée 4 fois revient à l'identité", () => {
    for (const f of "URFDLB") expect(applyAlg(SOLVED, `${f} ${f} ${f} ${f}`)).toBe(SOLVED);
  });

  it("R' = R R R et R2 = R R", () => {
    for (const f of "URFDLB") {
      expect(applyMove(SOLVED, `${f}'`)).toBe(applyAlg(SOLVED, `${f} ${f} ${f}`));
      expect(applyMove(SOLVED, `${f}2`)).toBe(applyAlg(SOLVED, `${f} ${f}`));
    }
  });

  it("(R U R' U') × 6 = identité (sexy move)", () => {
    expect(applyAlg(SOLVED, "R U R' U' ".repeat(6))).toBe(SOLVED);
  });

  it("T-perm deux fois = identité, une fois ≠ identité", () => {
    const tperm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    expect(applyAlg(SOLVED, tperm)).not.toBe(SOLVED);
    expect(applyAlg(SOLVED, `${tperm} ${tperm}`)).toBe(SOLVED);
  });
});

describe("algorithmes", () => {
  it("un mélange suivi de son inverse revient à résolu", () => {
    const scramble = "D2 F' R2 U B2 L' F2 R U2 F D' L2 B R' U F2 D B' L U2";
    const s = applyAlg(SOLVED, scramble);
    expect(isSolved(s)).toBe(false);
    expect(isValidFacelets(s)).toBe(true);
    expect(applyAlg(s, invertAlg(scramble))).toBe(SOLVED);
  });

  it("parseMove", () => {
    expect(parseMove("R")).toEqual({ face: "R", amount: 1 });
    expect(parseMove("U'")).toEqual({ face: "U", amount: 3 });
    expect(parseMove("F2")).toEqual({ face: "F", amount: 2 });
    expect(() => parseMove("M")).toThrow();
  });

  it("isSolved ignore la lettre des centres", () => {
    expect(isSolved(SOLVED)).toBe(true);
    expect(isSolved("F".repeat(9) + SOLVED.slice(9))).toBe(true);
    expect(isSolved(applyMove(SOLVED, "R"))).toBe(false);
  });
});
