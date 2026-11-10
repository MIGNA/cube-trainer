import { describe, expect, it } from "vitest";
import { BEGINNER_STEPS } from "./beginner";
import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, parseAnyAlg } from "./facelets";
import { CORNERS, EDGES, readOrbit } from "./pieces";
import { EO_CASES, showsCaseState, caseState } from "./cases";

const algs = BEGINNER_STEPS.flatMap((s) => s.algs);
const byName = (name: string) => algs.find((a) => a.name === name)!.alg;

/** Où arrive chaque autocollant : on applique l'algo à un cube aux 54 autocollants distincts. */
function sticker(alg: string, to: number): number {
  const label = Array.from({ length: 54 }, (_, i) => String.fromCharCode(48 + i)).join("");
  return applyAlg(label, alg).charCodeAt(to) - 48;
}

describe("méthode débutant", () => {
  it("chaque histoire a une ligne par mouvement", () => {
    for (const a of algs) if (a.story) expect(a.story.length, a.name).toBe(parseAnyAlg(a.alg).length);
  });

  it("coins blancs : le sexy move répété 1, 3 ou 5 fois place le coin d'en haut, quel que soit son sens", () => {
    const sexy = byName("Le sexy move, répété");
    const rep = (k: number) => Array(k).fill(sexy).join(" ");
    // Le coin DRF en haut (UFR) avec ses 3 orientations possibles = cube résolu après 1, 3 ou 5 sexy moves « à l'envers ».
    const twists = [1, 3, 5].map((k) => {
      const c = readOrbit(applyAlg(SOLVED, rep(6 - k)), CORNERS);
      expect(c.pieces[0], `${k}`).toBe(4);
      return c.orientation[0];
    });
    expect(new Set(twists).size).toBe(3);
    expect(applyAlg(SOLVED, rep(6))).toBe(SOLVED);
  });

  it("marguerite : F U' R remonte une arête blanche couchée", () => {
    const pos = Array.from({ length: 54 }, (_, i) => i).find((p) => sticker("F U' R", p) === 19);
    expect([1, 3, 5, 7]).toContain(pos);
  });

  it("le Belge garde la face du bas et descend l'arête de devant à sa place", () => {
    // Première couche (en bas) : face D + rangée du bas de F, R, L, B.
    const firstLayer = [27, 28, 29, 30, 31, 32, 33, 34, 35, 24, 25, 26, 15, 16, 17, 42, 43, 44, 51, 52, 53];
    for (const name of ["Le Belge (vers la droite)", "Le Belge (vers la gauche)"]) {
      expect(allSolved(applyAlg(SOLVED, byName(name)), firstLayer), name).toBe(true);
    }
    // Droite : la face avant de l'arête UF (19) arrive devant dans le créneau FR (23), son dessus (7) à droite (12).
    expect(sticker(byName("Le Belge (vers la droite)"), 23)).toBe(19);
    expect(sticker(byName("Le Belge (vers la droite)"), 12)).toBe(7);
    // Gauche : vers le créneau FL (21 devant, 41 à gauche).
    expect(sticker(byName("Le Belge (vers la gauche)"), 21)).toBe(19);
    expect(sticker(byName("Le Belge (vers la gauche)"), 41)).toBe(7);
  });

  it("dernière couche : les deux premières couches restent intactes", () => {
    for (const step of BEGINNER_STEPS.slice(3)) {
      for (const a of step.algs) expect(allSolved(applyAlg(SOLVED, a.alg), CROSS_GROUPS.D.f2l), a.name).toBe(true);
    }
  });

  it("croix jaune : ligne et L, tenus comme sur le schéma", () => {
    expect(showsCaseState(caseState(byName("Deux arêtes opposées")), EO_CASES.find((c) => c.name === "Ligne")!)).toBe(true);
    expect(showsCaseState(caseState(byName("Deux arêtes voisines")), EO_CASES.find((c) => c.name === "L")!)).toBe(true);
  });

  it("la chaise : arête de devant fixe, les trois autres en sens horaire", () => {
    const e = readOrbit(applyAlg(SOLVED, byName("La chaise")), EDGES);
    // UF=0, UR=1, UB=2, UL=3 : UB → UR, UL → UB, UR → UL (vu de dessus, sens horaire).
    expect(e.pieces.slice(0, 4)).toEqual([0, 2, 3, 1]);
    expect(e.orientation.slice(0, 4)).toEqual([0, 0, 0, 0]);
  });

  it("le petit curieux : coin devant à droite fixe, les autres en sens horaire, arêtes intactes", () => {
    const s = applyAlg(SOLVED, byName("Le petit curieux"));
    const c = readOrbit(s, CORNERS);
    // UFR=0, URB=1, UBL=2, ULF=3 : ULF → UBL → URB → ULF.
    expect(c.pieces.slice(0, 4)).toEqual([0, 2, 3, 1]);
    expect(readOrbit(s, EDGES).pieces).toEqual([...EDGES.keys()]);
  });

  it("orienter les coins : seuls les deux coins de droite tournent", () => {
    const s = applyAlg(SOLVED, byName("Chaise main droite + main gauche"));
    const c = readOrbit(s, CORNERS);
    expect(c.pieces).toEqual([...CORNERS.keys()]);
    expect(c.orientation.slice(0, 4).map((o) => o !== 0)).toEqual([true, true, false, false]);
    expect(readOrbit(s, EDGES).pieces).toEqual([...EDGES.keys()]);
  });
});
