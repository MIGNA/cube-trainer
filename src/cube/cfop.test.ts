import { describe, expect, it } from "vitest";
import { OLL_CASES, PLL_CASES } from "./cases";
import { analyzeSolve, type SolveAnalysis } from "./cfop";
import { invertAlg, parseAnyAlg } from "./facelets";

/** Décompose un algo en quarts de tour de faces, comme les envoie le cube (R2 → R R). */
function quarterTurns(alg: string): string[] {
  return parseAnyAlg(alg).flatMap((t) => {
    if (!"URFDLB".includes(t.base)) throw new Error(`pas un mouvement de face : ${t.base}`);
    return t.amount === 2 ? [t.base, t.base] : [t.base + (t.amount === 3 ? "'" : "")];
  });
}

/** Construit un solve : mélange = inverse de la solution, un mouvement toutes les `stepMs`. */
function solve(solution: string, stepMs = 100) {
  const moves = quarterTurns(solution).map((m, i) => ({ m, t: i * stepMs }));
  return { scramble: invertAlg(solution), moves };
}

const byId = (a: SolveAnalysis, id: string) => a.steps.find((s) => s.id === id)!;
const sune = OLL_CASES.find((c) => c.id === "OLL 27")!.alg;
const tperm = PLL_CASES.find((c) => c.id === "T")!.alg;

describe("analyzeSolve", () => {
  it("renvoie null si le cube n'est pas résolu à la fin", () => {
    expect(analyzeSolve("R U", [{ m: "U'", t: 0 }])).toBeNull();
    expect(analyzeSolve("R", [])).toBeNull();
  });

  it("PLL seule (T-perm) : croix en bas, OLL skip", () => {
    const { scramble, moves } = solve(tperm);
    const a = analyzeSolve(scramble, moves)!;
    expect(a.crossFace).toBe("D");
    expect(a.oll).toBe("skip");
    expect(a.pll).toBe("T");
    expect(byId(a, "cross").moves).toBe(0);
    expect(byId(a, "oll").moves).toBe(0);
    expect(byId(a, "pll").moves).toBe(moves.length);
    expect(a.totalMoves).toBe(moves.length);
  });

  it("OLL puis PLL : Sune + T-perm", () => {
    const { scramble, moves } = solve(`${sune} ${tperm}`);
    const a = analyzeSolve(scramble, moves)!;
    expect(a.oll).toBe("OLL 27");
    expect(a.pll).toBe("T");
    expect(byId(a, "oll").moves).toBe(quarterTurns(sune).length);
    expect(byId(a, "pll").moves).toBe(quarterTurns(tperm).length);
  });

  it("dernière paire F2L puis skips", () => {
    const { scramble, moves } = solve("R U' R'");
    const a = analyzeSolve(scramble, moves)!;
    expect(["f2l1", "f2l2", "f2l3"].map((id) => byId(a, id).moves)).toEqual([0, 0, 0]);
    expect(byId(a, "f2l4").moves).toBe(3);
    // R U' R' défait puis refait l'emplacement avant-droit : vert-rouge
    expect([...byId(a, "f2l4").slot!].sort()).toEqual(["F", "R"]);
    expect(a.oll).toBe("skip");
    expect(a.pll).toBe("skip");
  });

  it("reconnaissance et exécution : la pause avant une étape compte en reconnaissance", () => {
    const sol = quarterTurns(`${sune} ${tperm}`);
    const ollLen = quarterTurns(sune).length;
    // 100 ms entre les mouvements, sauf 1,5 s de pause avant la PLL
    const moves = sol.map((m, i) => ({ m, t: i * 100 + (i >= ollLen ? 1500 : 0) }));
    const a = analyzeSolve(invertAlg(`${sune} ${tperm}`), moves)!;
    const pll = byId(a, "pll");
    expect(pll.recognitionMs).toBe(1600); // 1,5 s de pause + 100 ms d'écart normal
    expect(pll.executionMs).toBe((quarterTurns(tperm).length - 1) * 100);
    expect(pll.durationMs).toBe(pll.recognitionMs + pll.executionMs);
    expect(a.totalMs).toBe(moves[moves.length - 1].t);
    // la somme des étapes = temps total
    expect(a.steps.reduce((s, x) => s + x.durationMs, 0)).toBe(a.totalMs);
  });

  it("croix sur une autre face (U) : mêmes cas reconnus", () => {
    // x2 : U↔D, F↔B, R et L inchangés
    const flip = (alg: string) => alg.replace(/[UDFB]/g, (c) => ({ U: "D", D: "U", F: "B", B: "F" })[c]!);
    const { scramble, moves } = solve(flip(`${sune} ${tperm}`));
    const a = analyzeSolve(scramble, moves)!;
    expect(a.crossFace).toBe("U");
    expect(a.oll).toBe("OLL 27");
    expect(a.pll).toBe("T");
  });

  it("solve complet : croix, 4 paires, OLL, PLL dans l'ordre", () => {
    // Solution construite à l'envers : on « défait » chaque étape depuis le cube résolu.
    const cross = "D R' F2"; // casse la croix (et d'autres pièces)
    const pairs = ["R U' R'", "L' U L", "F U F'", "B' U' B"];
    const solution = `${invertAlg(cross)} ${pairs.join(" ")} ${sune} ${tperm}`;
    // On vérifie seulement la cohérence : étapes dans l'ordre, fins croissantes.
    const { scramble, moves } = solve(solution);
    const a = analyzeSolve(scramble, moves)!;
    const ends = a.steps.map((s) => s.endMs);
    expect([...ends].sort((x, y) => x - y)).toEqual(ends);
    expect(a.steps.reduce((s, x) => s + x.moves, 0)).toBe(moves.length);
    // les 4 paires occupent 4 emplacements différents
    const slots = ["f2l1", "f2l2", "f2l3", "f2l4"].map((id) => [...byId(a, id).slot!].sort().join(""));
    expect(new Set(slots).size).toBe(4);
  });
});
