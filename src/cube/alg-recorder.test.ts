import { describe, expect, it } from "vitest";
import { SOLVED, applyMove, invertAlg } from "./facelets";
import { ALL_CASES, findCase, suggestedAlgs } from "./case-algs";
import { checkCaseAlg } from "./cases";
import { physicalQuarters, switchFrame } from "./setup";
import { holdingRotation, type Holding } from "../training/warmup";
import { AlgRecorder } from "./alg-recorder";

const STD: Holding = { up: "U", front: "F" };
/** Quarts de tour envoyés par le cube pour une formule, en tenant le cube ainsi. */
const cube = (moves: string, holding: Holding = STD) => physicalQuarters(`${holdingRotation(holding)} ${moves}`).map(switchFrame);

/** Joue des quarts de tour (repère cube) en prévenant l'enregistreur ; renvoie l'état final. */
function play(rec: AlgRecorder, start: string, moves: string[]): string {
  let state = start;
  for (const m of moves) {
    state = applyMove(state, m);
    rec.update(state, m);
  }
  return state;
}

/** Cube (repère cube) d'où les quarts de tour de `alg` ramènent au résolu (cas montré à l'angle de la formule). */
const setUp = (alg: string, holding: Holding = STD) =>
  invertAlg(cube(alg, holding).join(" ")).split(" ").reduce(applyMove, SOLVED);

describe("enregistrement d'un algo avec le cube", () => {
  it("chaque algo proposé, fait sur le cube, ressort en une formule valide pour son cas", () => {
    for (const c of ALL_CASES) {
      for (const a of suggestedAlgs(c)) {
        const rec = new AlgRecorder(c);
        const start = setUp(a);
        rec.update(start);
        expect(rec.phase, `${c.id} : ${a}`).toBe("recording");
        play(rec, start, cube(a));
        expect(rec.phase, `${c.id} : ${a}`).toBe("done");
        expect(checkCaseAlg(c, rec.alg).ok, `${c.id} : ${a} → ${rec.alg}`).toBe(true);
      }
    }
  });

  it("formule en tours de faces : rendue telle quelle (R R → R2)", () => {
    const t = findCase("T")!;
    const rec = new AlgRecorder(t);
    const start = setUp(t.alg);
    rec.update(start);
    play(rec, start, cube(t.alg));
    expect(rec.alg).toBe(t.alg);
  });

  it("attend que le cube montre le cas avant d'enregistrer", () => {
    const t = findCase("T")!;
    const rec = new AlgRecorder(t);
    rec.update(SOLVED);
    expect(rec.phase).toBe("waiting");
    // Les mouvements du set-up ne sont pas enregistrés.
    const start = play(rec, SOLVED, cube(invertAlg(t.alg)));
    expect(rec.phase).toBe("recording");
    expect(rec.count).toBe(0);
    play(rec, start, cube(t.alg));
    expect(rec.alg).toBe(t.alg);
  });

  it("face qui hésite (U U') et AUF de départ : retirés", () => {
    const jb = findCase("Jb")!;
    const rec = new AlgRecorder(jb);
    const start = setUp(jb.alg);
    rec.update(start);
    // AUF U d'abord, puis la formule faite depuis cet angle avec une hésitation au milieu.
    const moves = jb.alg.split(" ");
    const jittery = [...moves.slice(0, 3), "U", "U'", ...moves.slice(3)].join(" ");
    play(rec, start, cube(`U ${invertAlg("U")} ${jittery}`));
    expect(rec.phase).toBe("done");
    expect(rec.alg).toBe(jb.alg);
  });

  it("retour à l'état de départ : on repart de zéro", () => {
    const t = findCase("T")!;
    const rec = new AlgRecorder(t);
    const start = setUp(t.alg);
    rec.update(start);
    play(rec, start, cube("R U R' U' U R U' R'"));
    expect(rec.count).toBe(0);
    play(rec, start, cube(t.alg));
    expect(rec.alg).toBe(t.alg);
  });

  it("tenue réglée : mouvements écrits comme le joueur les voit", () => {
    const holding: Holding = { up: "U", front: "R" };
    const t = findCase("T")!;
    const rec = new AlgRecorder(t, holding);
    const start = setUp(t.alg, holding);
    rec.update(start);
    play(rec, start, cube(t.alg, holding));
    expect(rec.alg).toBe(t.alg);
  });
});
