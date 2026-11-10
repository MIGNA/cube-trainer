import { describe, expect, it } from "vitest";
import { OLL_CASES, PLL_CASES } from "./cases";
import { caseView, lastLayerView } from "./case-diagram";
import { SOLVED } from "./facelets";

const pll = (id: string) => caseView(PLL_CASES.find((c) => c.id === id)!.alg);
const swaps = (arrows: [number, number][]) => arrows.filter(([a, b]) => arrows.some(([c, d]) => c === b && d === a)).length / 2;

describe("lastLayerView", () => {
  it("cube résolu : face U uniforme, bords à leur couleur, aucune flèche", () => {
    const v = lastLayerView(SOLVED);
    expect(v.top.every((f) => f === "U")).toBe(true);
    expect(v.sides.F).toEqual(["F", "F", "F"]);
    expect(v.sides.R).toEqual(["R", "R", "R"]);
    expect(v.arrows).toEqual([]);
  });

  it("Sune (OLL 27) : 4 coins dont 1 orienté, croix orientée, pas de flèches", () => {
    const v = caseView(OLL_CASES.find((c) => c.id === "OLL 27")!.alg);
    expect([1, 3, 5, 7].every((i) => v.top[i] === "U")).toBe(true);
    expect([0, 2, 6, 8].filter((i) => v.top[i] === "U")).toHaveLength(1);
    expect(v.arrows).toEqual([]);
  });

  it("T-perm : échange 2 arêtes et 2 coins", () => {
    const v = pll("T");
    expect(v.arrows).toHaveLength(4);
    expect(swaps(v.arrows)).toBe(2);
  });

  it("Ua / Ub : 3-cycle d'arêtes, dans des sens opposés", () => {
    const a = pll("Ua").arrows;
    const b = pll("Ub").arrows;
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(swaps(a)).toBe(0);
    // mêmes cases, sens inverse
    const key = (arr: [number, number][]) => arr.map(([x, y]) => `${x}>${y}`).sort();
    expect(key(b)).toEqual(key(a.map(([x, y]) => [y, x] as [number, number])));
  });

  it("H-perm : 2 échanges d'arêtes opposées ; E-perm : 2 échanges de coins", () => {
    expect(swaps(pll("H").arrows)).toBe(2);
    expect(pll("H").arrows.every(([c]) => [1, 3, 5, 7].includes(c))).toBe(true);
    expect(pll("E").arrows.every(([c]) => [0, 2, 6, 8].includes(c))).toBe(true);
  });

  it("chaque PLL a des flèches, toutes les flèches arrivent sur des cases distinctes", () => {
    for (const c of PLL_CASES) {
      const { arrows } = caseView(c.alg);
      expect(arrows.length).toBeGreaterThan(0);
      expect(new Set(arrows.map(([, t]) => t)).size).toBe(arrows.length);
    }
  });
});

// Flèches de référence de jperm.net/algs/pll (cases de la face U numérotées 0-8,
// ligne 0 côté arrière). Comparées à une rotation du schéma près.
const JPERM_ARROWS: Record<string, [number, number][]> = {
  H: [[1, 7], [7, 1], [3, 5], [5, 3]],
  Z: [[3, 7], [7, 3], [1, 5], [5, 1]],
  Ua: [[5, 3], [7, 5], [3, 7]],
  Ub: [[3, 5], [5, 7], [7, 3]],
  Aa: [[2, 6], [6, 0], [0, 2]],
  Ab: [[8, 0], [0, 6], [6, 8]],
  E: [[0, 6], [6, 0], [2, 8], [8, 2]],
  F: [[1, 7], [7, 1], [2, 8], [8, 2]],
  Ja: [[1, 5], [5, 1], [2, 8], [8, 2]],
  Jb: [[5, 7], [7, 5], [2, 8], [8, 2]],
  Ra: [[1, 3], [3, 1], [2, 8], [8, 2]],
  Rb: [[3, 7], [7, 3], [2, 8], [8, 2]],
  T: [[3, 5], [5, 3], [2, 8], [8, 2]],
  Y: [[1, 3], [3, 1], [0, 8], [8, 0]],
  V: [[1, 5], [5, 1], [0, 8], [8, 0]],
  Na: [[3, 5], [5, 3], [2, 6], [6, 2]],
  Nb: [[3, 5], [5, 3], [0, 8], [8, 0]],
};

const rotateCell = (i: number) => (i % 3) * 3 + (2 - Math.floor(i / 3));
const arrowKey = (a: [number, number][]) => a.map(([x, y]) => `${x}>${y}`).sort().join(" ");
function sameUpToRotation(a: [number, number][], b: [number, number][]): boolean {
  let cur = a;
  for (let k = 0; k < 4; k++) {
    if (arrowKey(cur) === arrowKey(b)) return true;
    cur = cur.map(([x, y]) => [rotateCell(x), rotateCell(y)]);
  }
  return false;
}

describe("flèches PLL comparées à jperm.net", () => {
  it.each(Object.entries(JPERM_ARROWS))("%s", (id, ref) => {
    expect(sameUpToRotation(pll(id).arrows, ref)).toBe(true);
  });

  it.each(["Ga", "Gb", "Gc", "Gd"])("%s : un cycle de 3 coins et un cycle de 3 arêtes", (id) => {
    const { arrows } = pll(id);
    const corners = arrows.filter(([c]) => [0, 2, 6, 8].includes(c));
    const edges = arrows.filter(([c]) => [1, 3, 5, 7].includes(c));
    expect(corners).toHaveLength(3);
    expect(edges).toHaveLength(3);
    expect(swaps(arrows)).toBe(0);
  });
});
