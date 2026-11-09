import { describe, expect, it } from "vitest";
import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, applyMove, invertAlg, isSolved, isValidFacelets, parseMove } from "./facelets";

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

describe("notation étendue", () => {
  const scrambled = applyAlg(SOLVED, "D2 F' R2 U B2 L' F2 R U2 F");
  const same = (a: string, b: string) => expect(applyAlg(scrambled, a)).toBe(applyAlg(scrambled, b));

  it("doubles couches : r = R M', Rw = r, u = U E'", () => {
    same("r", "R M'");
    same("Rw", "r");
    same("u", "U E'");
    same("f", "F S");
  });

  it("rotations : x = R M' L', y = U E' D', z = F S B'", () => {
    same("x", "R M' L'");
    same("y", "U E' D'");
    same("z", "F S B'");
  });

  it("rotation × 4 = identité, et les parenthèses sont ignorées", () => {
    same("x x x x", "");
    same("(R U R' U')", "R U R' U'");
  });

  it("H-perm (M2 U M2 U2 M2 U M2) deux fois = identité", () => {
    const h = "M2 U M2 U2 M2 U M2";
    expect(applyAlg(SOLVED, `${h} ${h}`)).toBe(SOLVED);
  });
});

describe("groupes CFOP", () => {
  it("tailles : croix 8 autocollants, 4 emplacements de 5, F2L 33", () => {
    for (const g of Object.values(CROSS_GROUPS)) {
      expect(g.cross).toHaveLength(8);
      expect(g.slots).toHaveLength(4);
      for (const s of g.slots) expect(s).toHaveLength(5);
      expect(g.f2l).toHaveLength(33);
      expect(g.lastLayerFace).toHaveLength(9);
    }
  });

  it("R U R' casse un seul emplacement de la croix D, sans casser la croix", () => {
    const s = applyAlg(SOLVED, "R U R'");
    const g = CROSS_GROUPS.D;
    expect(allSolved(s, g.cross)).toBe(true);
    expect(g.slots.filter((slot) => allSolved(s, slot))).toHaveLength(3);
  });
});
