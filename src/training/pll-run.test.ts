import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, applyMove } from "../cube/facelets";
import { PLL_CASES } from "../cube/cases";
import { suggestedAlgs } from "../cube/case-algs";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { PllRunTracker, pllStats } from "./pll-run";
import { holdingRotation, type Holding } from "./warmup";

const scrambled = applyAlg(SOLVED, "R U2 F' L D' B2 R' U F2 D L' B U2");
const alg = (id: string) => PLL_CASES.find((c) => c.id === id)!.alg;

/** Quarts de tour envoyés par le cube pour une formule, en tenant le cube ainsi. */
const cube = (moves: string, holding: Holding = { up: "U", front: "F" }) =>
  physicalQuarters(`${holdingRotation(holding)} ${moves}`).map(switchFrame);

function play(tracker: PllRunTracker, start: string, moves: string[]): { state: string; found: string[] } {
  let state = start;
  const found: string[] = [];
  for (const m of moves) {
    state = applyMove(state, m);
    const e = tracker.move(m, state);
    if (e?.kind === "pll") found.push(e.done.id);
  }
  return { state, found };
}

describe("toutes mes PLL", () => {
  it("chaque formule proposée est reconnue comme la bonne PLL, sans erreur", () => {
    for (const c of PLL_CASES) {
      for (const a of suggestedAlgs(c)) {
        const tracker = new PllRunTracker({ [c.id]: a }, scrambled);
        expect(play(tracker, scrambled, cube(a)).found, `${c.id} : ${a}`).toEqual([c.id]);
        expect(tracker.done[0].extra, `${c.id} : ${a}`).toBe(0);
      }
    }
  });

  it("enchaînement avec AUF, cube tourné, blanc en haut (la tenue réglée ne compte pas)", () => {
    const tracker = new PllRunTracker({}, scrambled);
    let { state, found } = play(tracker, scrambled, cube(`U ${alg("T")} U'`));
    expect(found).toEqual(["T"]);
    ({ state, found } = play(tracker, state, cube(`y ${alg("Ja")}`))); // rouge devant
    expect(found).toEqual(["Ja"]);
    ({ found } = play(tracker, state, cube(`U2 ${alg("H")}`, { up: "D", front: "F" })));
    expect(found).toEqual(["H"]);
    expect(tracker.done.map((d) => d.extra)).toEqual([0, 0, 0]); // le U' d'après le T compte comme AUF du Ja
  });

  it("erreur, retour à l'état d'avant, puis la PLL : reconnue, la tentative ratée compte en erreurs", () => {
    const t = alg("T");
    const tracker = new PllRunTracker({ T: t }, scrambled);
    const moves = cube(t);
    // 5 mouvements de la formule, une erreur (F), puis tout défait.
    const wrong = [...moves.slice(0, 5), "F"];
    const undo = [...wrong].reverse().map((m) => (m.endsWith("'") ? m[0] : `${m}'`));
    let state = scrambled;
    const events = [...wrong, ...undo].map((m) => {
      state = applyMove(state, m);
      return tracker.move(m, state);
    });
    expect(events.at(-1)).toEqual({ kind: "back" });
    expect(tracker.done).toEqual([]);
    expect(play(tracker, state, moves).found).toEqual(["T"]);
    expect(tracker.done[0].extra).toBe(12);
  });

  it("mouvements en trop comptés, puis bilan par PLL", () => {
    const t = alg("T");
    const tracker = new PllRunTracker({ T: t }, scrambled);
    const moves = cube(t);
    const { state } = play(tracker, scrambled, [...moves.slice(0, 3), "F", "F'", ...moves.slice(3)]);
    expect(tracker.done).toEqual([
      // Mouvements faits écrits comme le joueur tient le cube (jaune en haut) : le F F' apparaît.
      { id: "T", moves: moves.length + 2, extra: 2, expected: t, played: "R U R' F F' U' R' F R2 U' R' U' R U R' F'" },
    ]);
    play(tracker, state, moves);
    expect(pllStats(tracker.done)).toEqual([{ id: "T", count: 2, clean: 1, withErrors: 1, extra: 2, moves: 2 * moves.length + 2 }]);
    // Une erreur énorme ne pèse pas plus qu'une petite : on trie par passages ratés.
    const stats = pllStats([
      { id: "Ja", moves: 80, extra: 60 },
      { id: "Ja", moves: 13, extra: 0 },
      { id: "Ja", moves: 13, extra: 0 },
      { id: "Ua", moves: 12, extra: 1 },
      { id: "Ua", moves: 12, extra: 1 },
    ]);
    expect(stats.map((s) => [s.id, s.clean, s.withErrors])).toEqual([
      ["Ua", 0, 2],
      ["Ja", 2, 1],
    ]);
  });

  it("gestes : U4 = repartir d'ici, D4 = annuler la dernière PLL (face du haut / du bas de la tenue)", () => {
    const tracker = new PllRunTracker({}, scrambled);
    let { state } = play(tracker, scrambled, cube(alg("T")));
    expect(tracker.done.map((d) => d.id)).toEqual(["T"]);
    // Début de Ja raté, puis U4 (jaune en haut → le cube voit D) : on repart d'ici, rien de compté.
    ({ state } = play(tracker, state, [...cube(alg("Ja")).slice(0, 4), "R"]));
    let e = null;
    for (const m of cube("U U U U")) {
      state = applyMove(state, m);
      e = tracker.move(m, state);
    }
    expect(e).toEqual({ kind: "reset" });
    expect(tracker.since).toBe(0);
    ({ state } = play(tracker, state, cube(alg("H"))));
    expect(tracker.done.map((d) => d.id)).toEqual(["T", "H"]);
    expect(tracker.done[1].extra).toBe(0);
    // D4 : la dernière (H) est annulée.
    for (const m of cube("D' D' D' D'")) {
      state = applyMove(state, m);
      e = tracker.move(m, state);
    }
    expect(e).toEqual({ kind: "undo", done: expect.objectContaining({ id: "H" }) });
    expect(tracker.done.map((d) => d.id)).toEqual(["T"]);
    expect(tracker.since).toBe(0);
  });

  it("R4 = terminer ; tentative ratée gardée pour l'affichage", () => {
    const t = alg("T");
    const tracker = new PllRunTracker({ T: t }, scrambled);
    // Début raté (R U R'), défait (R U' R'), puis la T.
    let { state } = play(tracker, scrambled, cube("R U R' R U' R'"));
    ({ state } = play(tracker, state, cube(t)));
    expect(tracker.done[0]).toMatchObject({ id: "T", extra: 6, failed: "R U R' R U' R'", played: t });
    let e = null;
    for (const m of cube("R R R R")) {
      state = applyMove(state, m);
      e = tracker.move(m, state);
    }
    expect(e).toEqual({ kind: "end" });
  });

  it("une simple suite de triggers n'est pas prise pour une PLL", () => {
    const tracker = new PllRunTracker({}, scrambled);
    expect(play(tracker, scrambled, cube("R U R' U' R U R' U' R U R' U'")).found).toEqual([]);
  });
});
