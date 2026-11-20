import { describe, expect, it } from "vitest";
import { SOLVED, applyAlg, applyMove } from "../cube/facelets";
import { PLL_CASES, checkCaseAlg } from "../cube/cases";
import { suggestedAlgs } from "../cube/case-algs";
import { physicalQuarters, switchFrame } from "../cube/setup";
import { PllRunTracker, groupErrors, markPlayed, pllStats, successRate, type ErrorGroup, type PllDone } from "./pll-run";
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

  it("erreur, retour à l'état d'avant, puis la PLL : reconnue, le faux départ ne compte pas en erreurs", () => {
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
    expect(tracker.done[0]).toMatchObject({ extra: 0, moves: moves.length });
  });

  it("mouvements en trop comptés, puis bilan par PLL", () => {
    const t = alg("T");
    const tracker = new PllRunTracker({ T: t }, scrambled);
    const moves = cube(t);
    const { state } = play(tracker, scrambled, [...moves.slice(0, 3), "F", "F'", ...moves.slice(3)]);
    expect(tracker.done).toMatchObject([
      // Mouvements faits écrits comme le joueur tient le cube (jaune en haut) : le F F' apparaît.
      { id: "T", moves: moves.length + 2, extra: 2, expected: t, played: "R U R' F F' U' R' F R2 U' R' U' R U R' F'" },
    ]);
    // … et repéré comme en trop.
    expect(tracker.done[0].marks!.filter((m) => m.kind === "extra").map((m) => m.text)).toEqual(["F", "F'"]);
    play(tracker, state, moves);
    expect(pllStats(tracker.done)).toEqual([{ id: "T", count: 2, clean: 1, withErrors: 1, extra: 2, moves: 2 * moves.length + 2, cleanTimeMs: null }]);
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

  it("R4 = terminer ; faux départ gardé pour l'affichage, aller-retour oublié", () => {
    const t = alg("T");
    const tracker = new PllRunTracker({ T: t }, scrambled);
    // Aller-retour (B B'), début raté (R U R'), défait (R U' R'), puis la T.
    let { state } = play(tracker, scrambled, cube("B B' R U R' R U' R'"));
    ({ state } = play(tracker, state, cube(t)));
    expect(tracker.done[0]).toMatchObject({ id: "T", extra: 0, falseStart: "R U R' R U' R'", played: t });
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

  it("temps d'exécution : premier → dernier mouvement ; moyenne sur les passages sans erreur", () => {
    const tracker = new PllRunTracker({}, SOLVED);
    let state = SOLVED;
    let t = 1000;
    const run = (moves: string[], step: number) => {
      let e = null;
      for (const m of moves) {
        state = applyMove(state, m);
        e = tracker.move(m, state, t);
        t += step;
      }
      return e;
    };
    t += 5000; // pause de reconnaissance : pas comptée
    const tperm = cube(alg("T"));
    const first = run(tperm, 100);
    expect(first?.kind === "pll" && first.done.timeMs).toBe((tperm.length - 1) * 100);
    // Second passage, avec une erreur : son temps n'entre pas dans la moyenne.
    const second = run([...tperm.slice(0, 3), "F", "F'", ...tperm.slice(3)], 300);
    expect(second?.kind === "pll" && second.done.extra).toBe(2);
    const third = run(tperm, 200);
    expect(third?.kind).toBe("pll");
    const [stat] = pllStats(tracker.done);
    expect(stat.cleanTimeMs).toBe(((tperm.length - 1) * 100 + (tperm.length - 1) * 200) / 2);
  });

  it("réussite : vert ≥ 90 %, orange ≥ 70 %, rouge en dessous, gris avec moins de 3 passages", () => {
    expect(successRate({ clean: 20, count: 22 })).toEqual({ rate: 20 / 22, tone: "ok" });
    expect(successRate({ clean: 8, count: 10 }).tone).toBe("warn");
    expect(successRate({ clean: 6, count: 10 }).tone).toBe("bad");
    expect(successRate({ clean: 1, count: 2 }).tone).toBe("few");
  });
});

describe("mouvements faits comparés à la formule", () => {
  const show = (marks: { text: string; kind: string }[]) => marks.map((m) => (m.kind === "ok" ? m.text : `[${m.kind}:${m.text}]`)).join(" ");
  const t = "R U R' U' R' F R2 U' R' U' R U R' F'";

  it("formule faite proprement : rien en trop", () => {
    expect(show(markPlayed(t, cube(t)))).toBe(t);
  });

  it("cube tenu autrement : lettres du joueur, pas d'erreur ; AUF à part", () => {
    expect(show(markPlayed(t, cube(`U ${t} U'`, { up: "F", front: "D" })))).toBe(`[auf:U] ${t} [auf:U']`);
  });

  it("mouvements en trop repérés", () => {
    expect(show(markPlayed(t, cube("R U R' U' R' F R R R R' U' R' U' R U R' F'")))).toBe("R U R' U' R' F R2 [extra:R] [extra:R'] U' R' U' R U R' F'");
  });

  it("demi-tour fait dans l'autre sens, M2 dans n'importe quel ordre", () => {
    const u = "M2 U M U2 M' U M2";
    expect(show(markPlayed("R U2 R'", cube("R U' U' R'")))).toBe("R U2 R'");
    expect(markPlayed(u, cube("L2 R2 U M U' U' M' U R2 L2")).every((m) => m.kind === "ok")).toBe(true);
  });
});

describe("autres formules", () => {
  it("formule suggérée autre que la mienne : comparée à celle-là, sans erreur", () => {
    const ja = PLL_CASES.find((c) => c.id === "Ja")!;
    const [std, other] = suggestedAlgs(ja);
    expect(other).toBeDefined();
    const tracker = new PllRunTracker({ Ja: [std] }, scrambled);
    play(tracker, scrambled, cube(other));
    expect(tracker.done[0]).toMatchObject({ id: "Ja", extra: 0, expected: other });
    expect(tracker.done[0].other).toBeUndefined();
  });

  it("formule inconnue : erreur, écrite jaune en haut (AUF retirés) ; ajoutée, elle devient connue", () => {
    // Ua en Anti-Sune + Sune : aucune formule suggérée ne lui ressemble.
    const unknown = "R' U' R U' R' U2 R U R U R' U R U2 R'";
    // Tenue réglée blanc en haut, cube tenu jaune en haut : la formule est quand même lisible.
    const tracker = new PllRunTracker({}, scrambled, { up: "D", front: "F" });
    const { state } = play(tracker, scrambled, cube(`U ${unknown}`));
    const d = tracker.done[0];
    expect(d).toMatchObject({ id: "Ua", other: unknown });
    expect(d.extra).toBeGreaterThan(0);
    expect(checkCaseAlg(PLL_CASES.find((c) => c.id === "Ua")!, d.other!).ok).toBe(true);
    tracker.addAlg(d.id, d.other!, true);
    play(tracker, state, cube(unknown));
    expect(tracker.done[1]).toMatchObject({ id: d.id, extra: 0, expected: d.other });
    expect(tracker.done[1].other).toBeUndefined();
  });
});

describe("erreurs du bilan", () => {
  const t = "R U R' U' R' F R2 U' R' U' R U R' F'";
  const pass = (moves: string): PllDone => {
    const marks = markPlayed(t, cube(moves));
    return { id: "T", moves: 0, extra: marks.filter((m) => m.kind === "extra").length, expected: t, marks };
  };
  const show = (g: ErrorGroup) => g.marks!.map((m) => (m.kind === "extra" ? `[${m.text}]` : m.text)).join(" ");

  it("même erreur au même endroit regroupée ; les autres à part", () => {
    const err = "R U R' U' R' F R2 R R' U' R' U' R U R' F'";
    const { frequent, isolated } = groupErrors([
      pass(err),
      pass(t),
      pass(`U ${err}`), // AUF en plus : même erreur
      pass("R U R' U' R' F R2 U' R' U' R U F F' R' F'"),
      { id: "Ua", moves: 0, extra: 3, expected: "…", other: "R U R'" },
    ]);
    expect(frequent).toHaveLength(1);
    expect(frequent[0].count).toBe(2);
    expect(show(frequent[0])).toBe("R U R' U' R' F R2 [R] [R'] U' R' U' R U R' F'");
    expect(isolated.map((g) => g.other ?? show(g))).toEqual(["R U R' U' R' F R2 U' R' U' R U [F] [F'] R' F'", "R U R'"]);
  });
});

describe("AUF hésitant", () => {
  it("U2 U' avant la formule : pas d'erreur", () => {
    const na = alg("Na");
    const tracker = new PllRunTracker({ Na: na }, scrambled);
    play(tracker, scrambled, cube(`U2 U' ${na}`));
    expect(tracker.done[0]).toMatchObject({ id: "Na", extra: 0 });
    expect(tracker.done[0].marks!.filter((m) => m.kind === "auf").map((m) => m.text)).toEqual(["U2", "U'"]);
  });
});
