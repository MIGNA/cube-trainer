import { describe, expect, it } from "vitest";
import { ALL_CASES, mainAlg, myAlgs, suggestedAlgs, withMain, without } from "./case-algs";
import { OLL_CASES, PLL_CASES, checkCaseAlg } from "./cases";

const pll = (id: string) => PLL_CASES.find((c) => c.id === id)!;
const oll = (id: string) => OLL_CASES.find((c) => c.id === id)!;

describe("suggestions", () => {
  it.each(ALL_CASES.flatMap((c) => suggestedAlgs(c).map((alg) => ({ id: c.id, c, alg }))))("$id : $alg", ({ c, alg }) => {
    expect(checkCaseAlg(c, alg)).toEqual({ ok: true, alg });
  });

  it("pas de doublon dans les suggestions", () => {
    for (const c of ALL_CASES) expect(new Set(suggestedAlgs(c)).size).toBe(suggestedAlgs(c).length);
  });
});

describe("checkCaseAlg", () => {
  it("accepte un AUF avant ou après, des parenthèses et la notation Rw", () => {
    expect(checkCaseAlg(pll("T"), "U (R U R' U') R' F R2 U' R' U' R U R' F' U2")).toEqual({
      ok: true,
      alg: "U R U R' U' R' F R2 U' R' U' R U R' F' U2",
    });
    expect(checkCaseAlg(oll("OLL 7"), "Rw U R' U R U2 Rw'")).toEqual({ ok: true, alg: "r U R' U R U2 r'" });
  });

  it("accepte un algo qui finit avec le cube tourné", () => {
    expect(checkCaseAlg(oll("OLL 27"), "y R U R' U R U2 R'").ok).toBe(true);
    expect(checkCaseAlg(pll("Aa"), "x R' U R' D2 R U' R' D2 R2").ok).toBe(true);
  });

  it("refuse un mouvement inconnu ou un algo vide", () => {
    expect(checkCaseAlg(pll("T"), "R U X")).toMatchObject({ ok: false });
    expect(checkCaseAlg(pll("T"), "  ")).toEqual({ ok: false, error: "Algo vide." });
  });

  it("refuse un algo qui casse les F2L", () => {
    expect(checkCaseAlg(pll("T"), "R U R'")).toEqual({ ok: false, error: "Cet algo casse les deux premières couches." });
  });

  it("indique quel cas l'algo résout s'il se trompe de cas", () => {
    expect(checkCaseAlg(pll("Ja"), pll("Jb").alg)).toEqual({ ok: false, error: "Cet algo résout la Jb-perm, pas ce cas." });
    expect(checkCaseAlg(oll("OLL 26"), oll("OLL 27").alg)).toEqual({ ok: false, error: "Cet algo résout OLL 27, pas ce cas." });
  });

  it("refuse un algo qui ne fait rien", () => {
    expect(checkCaseAlg(pll("T"), "U2")).toMatchObject({ ok: false });
  });
});

describe("mes algos", () => {
  it("par défaut, l'algo standard", () => {
    expect(myAlgs(pll("T"), {})).toEqual([pll("T").alg]);
    expect(mainAlg(pll("T"), { T: ["a", "b"] })).toBe("a");
  });

  it("withMain met en premier, without ne vide jamais la liste", () => {
    expect(withMain(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(withMain(["a"], "z")).toEqual(["z", "a"]);
    expect(without(["a", "b"], "a")).toEqual(["b"]);
    expect(without(["a"], "a")).toEqual(["a"]);
  });
});
