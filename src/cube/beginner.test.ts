import { describe, expect, it } from "vitest";
import { BEGINNER_STEPS, FIRST_LAYER, casePicture } from "./beginner";
import { stickerIndex, visibleStickers } from "./move-diagram";
import { permutationView } from "./case-diagram";
import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, formatMove, invertAlg, parseAnyAlg } from "./facelets";
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

  describe("coins blancs : monter, poser, redescendre", () => {
    // Coin DRF (pièce 4) au-dessus de sa place (UFR) ; blanc (D) sur l'autocollant 9 (droite), 20 (avant) ou 8 (haut).
    const UFR = { right: 9, front: 20, up: 8 };
    // Tout le bas sauf le coin DRF (29, 26, 15) : croix + 3 autres coins.
    const restOfBottom = [27, 28, 30, 31, 32, 33, 34, 35, 24, 25, 16, 17, 42, 43, 44, 51, 52, 53];
    const start = (name: string) => {
      const a = algs.find((x) => x.name === name)!;
      return applyAlg(SOLVED, invertAlg(a.pictureAlg ?? a.alg));
    };
    const cornerAt = (state: string, piece = 4) => readOrbit(state, CORNERS).pieces.indexOf(piece);

    it.each([
      ["Blanc devant", UFR.front],
      ["Blanc à droite", UFR.right],
      ["Blanc en haut", UFR.up],
    ] as [string, number][])("%s : coin au-dessus de sa place, blanc du bon côté, reste du bas intact", (name, white) => {
      const s = start(name);
      expect(s[white]).toBe("D");
      expect(cornerAt(s)).toBe(0);
      expect(allSolved(s, restOfBottom)).toBe(true);
    });

    it("blanc devant et blanc à droite : coin inséré bien orienté, croix intacte", () => {
      for (const name of ["Blanc devant", "Blanc à droite"]) {
        // allSolved compare aux centres : la rotation du cube (y) ne gêne pas.
        expect(allSolved(applyAlg(start(name), byName(name)), FIRST_LAYER), name).toBe(true);
      }
    });

    it("ce qui occupait la place est chassé en haut", () => {
      const s = start("Blanc devant");
      const intruder = readOrbit(s, CORNERS).pieces[4];
      expect(cornerAt(applyAlg(s, byName("Blanc devant")), intruder)).toBeLessThan(4);
    });

    it("blanc en haut : le blanc passe sur le côté, puis un demi-tour du haut donne « blanc à droite »", () => {
      const s = applyAlg(start("Blanc en haut"), byName("Blanc en haut"));
      expect(cornerAt(s)).toBeLessThan(4);
      expect(allSolved(s, restOfBottom)).toBe(true);
      const back = applyAlg(s, "U2");
      expect(cornerAt(back)).toBe(0);
      expect(back[UFR.right]).toBe("D");
      expect(allSolved(applyAlg(back, byName("Blanc à droite")), FIRST_LAYER)).toBe(true);
    });

    it("blanc en haut à gauche : le miroir L' U L, et pas l'inverse", () => {
      // Coin DFL (pièce 5) au-dessus de sa place (ULF), blanc vers le haut.
      const left = applyAlg(SOLVED, invertAlg("L' U2 L U L' U' L"));
      expect(left[6]).toBe("D");
      const restLeft = FIRST_LAYER.filter((i) => ![27, 24, 44].includes(i)); // tout le bas sauf le coin DFL
      const ok = applyAlg(left, "L' U L");
      expect(cornerAt(ok, 5)).toBeLessThan(4);
      expect(allSolved(ok, restLeft)).toBe(true);
      // R U' R' au mauvais endroit casse le coin de droite.
      expect(allSolved(applyAlg(start("Blanc en haut"), "L' U L"), restOfBottom)).toBe(false);
    });

    it("coin coincé en bas : il sort en haut quel que soit son sens, croix intacte", () => {
      const sexy = "R U R' U'";
      for (const twist of [0, 2, 4]) {
        const stuck = applyAlg(SOLVED, Array(twist).fill(sexy).join(" ") || "U U'");
        expect(cornerAt(stuck)).toBe(4);
        const out = applyAlg(stuck, byName("Coin coincé en bas"));
        expect(cornerAt(out)).toBeLessThan(4);
        expect(allSolved(out, restOfBottom)).toBe(true);
      }
    });
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

  it("le fêtard : coin devant à droite fixe, les autres en sens horaire, arêtes intactes", () => {
    const s = applyAlg(SOLVED, byName("Le fêtard"));
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

  it("images 3D : la pièce dont on parle est bien visible", () => {
    const visible = new Set(visibleStickers().map(stickerIndex));
    const withPiece = algs.filter((a) => a.piece);
    expect(withPiece.length).toBe(6);
    for (const a of withPiece) {
      const p = casePicture(a)!;
      const bright = p.emphasis.flatMap((k, i) => (k === 2 ? [i] : []));
      expect(bright.length, a.name).toBe(a.piece!.length);
      expect(bright.filter((i) => visible.has(i)).length, a.name).toBeGreaterThanOrEqual(2);
    }
  });

  it("les personnages bougent comme l'histoire le dit", () => {
    const track = (start: string, alg: string, find: (st: string) => number) => {
      let st = start;
      return parseAnyAlg(alg).map(formatMove).map((m) => ((st = applyAlg(st, m)), find(st)));
    };
    // Chaise : le Belge = coin DRF (pièce 4). UFR=0, UBL=2, ULF=3, DRF=4.
    const chair = track(SOLVED, byName("La chaise"), (st) => readOrbit(st, CORNERS).pieces.indexOf(4));
    expect(chair).toEqual([0, 2, 2, 3, 3, 0, 4]); // se lève, très loin, …, revient devant, se rassied
    // Belge : l'arête qui finit en FR part de UF. UF=0, UR=1, UL=3, FR=8.
    const alg = byName("Le Belge (vers la droite)");
    const start = applyAlg(SOLVED, invertAlg(alg));
    const belge = readOrbit(start, EDGES).pieces[0];
    expect(belge).toBe(8);
    expect(track(start, alg, (st) => readOrbit(st, EDGES).pieces.indexOf(belge))).toEqual([3, 3, 0, 0, 1, 1, 0, 8]);
    // Fêtard : le Belge = coin UFR (pièce 0) ; ULF=3. Il va à gauche, à droite, à gauche, puis rentre.
    const party = track(SOLVED, byName("Le fêtard"), (st) => readOrbit(st, CORNERS).pieces.indexOf(0));
    expect(party).toEqual([0, 3, 3, 0, 0, 3, 3, 0]);
  });

  it("schémas de la chaise et du fêtard : flèches malgré les coins tournés", () => {
    const isCorner = (cell: number) => cell % 2 === 0 && cell !== 4;
    // Chaise : l'arête de devant (case 7) fixe, les 3 autres (gauche 3, fond 1, droite 5) tournent.
    // (Les coins bougent aussi, mais on ne les regarde pas à cette étape : grisés sur le schéma.)
    const chair = permutationView(byName("La chaise")).arrows;
    expect(chair.filter(([c]) => !isCorner(c)).map(([c]) => c).sort()).toEqual([1, 3, 5]);
    // Fêtard : 3 coins qui tournent, dont pas celui devant à droite (case 8) ; arêtes fixes.
    const curious = permutationView(byName("Le fêtard")).arrows;
    expect(curious.filter(([c]) => isCorner(c))).toHaveLength(3);
    expect(curious.some(([c]) => c === 8)).toBe(false);
    expect(curious.filter(([c]) => !isCorner(c))).toHaveLength(0);
  });
});
