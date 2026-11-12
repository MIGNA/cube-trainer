import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg } from "./facelets";
import { inLayer, moveDiagram, stickerIndex, visibleStickers, type Vec3 } from "./move-diagram";

/** Face visible (U, F ou R) d'un point posé dessus, et indice Kociemba de l'autocollant. */
function sticker([x, y, z]: Vec3): { face: string; index: number } {
  const cell = (v: number) => Math.min(2, Math.floor(v));
  if (x === 3) return { face: "R", index: 9 + (2 - cell(y)) * 3 + (2 - cell(z)) };
  if (y === 3) return { face: "U", index: cell(z) * 3 + cell(x) };
  if (z === 3) return { face: "F", index: 18 + (2 - cell(y)) * 3 + cell(x) };
  throw new Error("point hors des faces visibles");
}

const ALL = ["R", "L", "U", "D", "F", "B", "M", "E", "S", "r", "l", "u", "d", "f", "b", "x", "y", "z"];

describe("moveDiagram", () => {
  // La flèche part d'une face et passe sur une autre : après le mouvement, l'autocollant
  // juste après le coude doit avoir la couleur de la face de départ.
  it.each(ALL.flatMap((m) => [m, `${m}'`]))("%s : la flèche suit le vrai sens de rotation", (m) => {
    const { path } = moveDiagram(m);
    const from = sticker(path[0]).face;
    const after: Vec3 = path[1].map((v, i) => v + 0.3 * (path[2][i] - v)) as Vec3;
    expect(applyAlg(SOLVED, m)[sticker(after).index]).toBe(from);
  });

  it("les autocollants hors de la couche ne bougent pas", () => {
    for (const m of ALL) {
      const d = moveDiagram(m);
      const state = applyAlg(SOLVED, m);
      for (const s of visibleStickers()) {
        if (inLayer(d, s.cubie)) continue;
        const c = s.corners.reduce<number[]>((a, p) => a.map((v, i) => v + p[i] / 4), [0, 0, 0]) as Vec3;
        expect(state[sticker(c).index], `${m} ${s.face}`).toBe(s.face);
      }
    }
  });

  it("accepte Rw, R2 et refuse l'inconnu", () => {
    expect(moveDiagram("Rw")).toEqual(moveDiagram("r"));
    expect(moveDiagram("R2").twice).toBe(true);
    expect(() => moveDiagram("Q")).toThrow();
  });
});

describe("stickerIndex", () => {
  it("donne le bon autocollant du format 54 facelets", () => {
    const all = visibleStickers();
    expect(new Set(all.map(stickerIndex)).size).toBe(27);
    for (const s of all) expect(SOLVED[stickerIndex(s)]).toBe(s.face);
    // R fait monter l'avant : sur le dessus, la colonne de droite devient verte (F).
    const r = applyAlg(SOLVED, "R");
    for (const s of all.filter((s) => s.face === "U")) expect(r[stickerIndex(s)]).toBe(s.cubie[0] === 2 ? "F" : "U");
    // U fait partir l'avant à gauche : la rangée du haut de F prend la couleur de R.
    const u = applyAlg(SOLVED, "U");
    for (const s of all.filter((s) => s.face === "F")) expect(u[stickerIndex(s)]).toBe(s.cubie[1] === 2 ? "R" : "F");
  });
});
