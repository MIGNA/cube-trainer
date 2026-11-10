import { describe, expect, it } from "vitest";
import { caseView, lastLayerView } from "./case-diagram";
import { ALL_CASES, suggestedAlgs } from "./case-algs";
import { CROSS_GROUPS, SOLVED, allSolved, applyAlg, isSolved, parseAlg } from "./facelets";
import { OLL_CASES, PLL_CASES, caseKind, showsCaseState, type CaseDef } from "./cases";
import { viewKey, mergeTurns, setupFromState, shortestSetup, switchFrame, toFaceTurns, toPlayerView } from "./setup";

const fmt = (alg: string) => mergeTurns(parseAlg(alg)).map((t) => t.face + ["", "", "2", "'"][t.amount]).join(" ");
const turns = (alg: string) =>
  toFaceTurns(alg)
    .map((t) => t.face + ["", "", "2", "'"][t.amount])
    .join(" ");

/** L'état (repère joueur) est-il le cas c, F2L faits ? */
function isCase(state: string, c: CaseDef): boolean {
  if (!allSolved(state, CROSS_GROUPS.D.f2l)) return false;
  return showsCaseState(state, c);
}

describe("toFaceTurns", () => {
  it("garde un algo déjà en tours de faces", () => {
    expect(turns("R U R' U'")).toBe("R U R' U'");
  });

  it("produit le même cas que l'algo d'origine (à une rotation près)", () => {
    for (const alg of ["r U R' U R U2 r'", "M2 U M2 U2 M2 U M2", "x R' U R' D2 R U' R' D2 R2 x'", "R' U R' U' y R' F' R2 U' R' U R' F R F", "S R U R' U' f'"]) {
      const a = applyAlg(SOLVED, turns(alg));
      const b = applyAlg(SOLVED, alg);
      // Même état à un recoloriage près : on compare les vues de dernière couche et les F2L.
      expect(JSON.stringify(lastLayerView(a)), alg).toBe(JSON.stringify(lastLayerView(b)));
    }
  });

  it("regroupe les tours", () => {
    expect(fmt("R R")).toBe("R2");
    expect(fmt("R R'")).toBe("");
    expect(fmt("R L R")).toBe("R2 L");
    expect(fmt("U R R' U")).toBe("U2");
  });
});

describe("shortestSetup", () => {
  it.each(ALL_CASES)("$id : le set-up mène au cas, sous l'angle du schéma", (c) => {
    const setup = shortestSetup(c, suggestedAlgs(c));
    expect(setup).toMatch(/^([URFDLB]['2]? ?)+$/);
    const state = applyAlg(SOLVED, setup);
    expect(isCase(state, c)).toBe(true);
    const kind = caseKind(c);
    expect(viewKey(lastLayerView(state), kind)).toBe(viewKey(caseView(c.alg), kind));
  });

  it("choisit le plus court", () => {
    const t = PLL_CASES.find((c) => c.id === "T")!;
    expect(parseAlg(shortestSetup(t, ["R U R' U' R' F R2 U' R' U' R U R' F'"])).length).toBe(14);
    const sune = OLL_CASES.find((c) => c.id === "OLL 27")!;
    expect(parseAlg(shortestSetup(sune, suggestedAlgs(sune))).length).toBeLessThanOrEqual(7);
  });
});

describe("repères", () => {
  it("un tour dans le repère joueur = le tour correspondant sur le cube", () => {
    const s = applyAlg(SOLVED, "R U F' D2");
    for (const m of ["R", "U", "F'", "D2", "L", "B"]) {
      expect(applyAlg(toPlayerView(s), m)).toBe(toPlayerView(applyAlg(s, switchFrame(m))));
    }
  });
});

describe("setupFromState", () => {
  const jb = PLL_CASES.find((c) => c.id === "Jb")!;
  const oll = OLL_CASES.find((c) => c.id === "OLL 45")!;

  it("cube résolu : le set-up court suffit", async () => {
    const setup = shortestSetup(jb, suggestedAlgs(jb));
    const moves = await setupFromState(SOLVED, setup);
    expect(moves).toBe(switchFrame(setup));
    expect(isCase(toPlayerView(applyAlg(SOLVED, moves)), jb)).toBe(true);
  });

  it("couche jaune décalée : on la recale d'abord", async () => {
    const setup = shortestSetup(jb, suggestedAlgs(jb));
    const current = applyAlg(SOLVED, "D");
    const moves = await setupFromState(current, setup);
    expect(isCase(toPlayerView(applyAlg(current, moves)), jb)).toBe(true);
    expect(isSolved(current)).toBe(false);
  });

  it("cube mélangé : le solveur amène au cas", async () => {
    for (const c of [jb, oll]) {
      const current = applyAlg(SOLVED, "R U2 F' L D' B2 R' U F2 D L' B U2");
      const moves = await setupFromState(current, shortestSetup(c, suggestedAlgs(c)));
      expect(moves).toMatch(/^([URFDLB]['2]? ?)+$/);
      expect(isCase(toPlayerView(applyAlg(current, moves)), c)).toBe(true);
    }
  }, 60_000);
});
