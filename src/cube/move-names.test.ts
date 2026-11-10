import { describe, expect, it } from "vitest";
import { BEGINNER_STEPS } from "./beginner";
import { formatMove, parseAnyAlg } from "./facelets";
import { describeMove } from "./move-names";

describe("describeMove", () => {
  it("décrit le geste en entier", () => {
    expect(describeMove("R")).toBe("face de droite, vers le haut");
    expect(describeMove("R'")).toBe("face de droite, vers le bas");
    expect(describeMove("U")).toBe("face du haut, vers la gauche");
    expect(describeMove("D'")).toBe("face du bas, vers la gauche");
    expect(describeMove("L")).toBe("face de gauche, vers le bas");
    expect(describeMove("U2")).toBe("face du haut, demi-tour");
    expect(describeMove("f")).toBe("deux couches de devant, sens des aiguilles d'une montre");
    expect(describeMove("r'")).toBe("deux couches de droite, vers le bas");
  });

  it("rien pour les autres mouvements", () => {
    expect(describeMove("M")).toBeNull();
    expect(describeMove("x")).toBeNull();
  });

  it("toutes les formules débutant sont traduites", () => {
    for (const a of BEGINNER_STEPS.flatMap((s) => s.algs)) {
      for (const m of parseAnyAlg(a.alg).map(formatMove)) expect(describeMove(m), `${a.name} : ${m}`).not.toBeNull();
    }
  });
});
