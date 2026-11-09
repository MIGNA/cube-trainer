import { describe, expect, it } from "vitest";
import { SOLVED, applyMove, invertAlg, parseAlg } from "./facelets";
import { ScrambleTracker } from "./scramble-tracker";
import { SmartSession, solveDuration, type SmartResult } from "./smart-session";

/** Décompose un algo en quarts de tour, comme les envoie le cube (R2 → R R). */
function quarterTurns(alg: string): string[] {
  return parseAlg(alg).flatMap((t) =>
    t.amount === 2 ? [t.face, t.face] : [t.face + (t.amount === 3 ? "'" : "")],
  );
}

describe("ScrambleTracker", () => {
  it("suit un mélange fait en quarts de tour", () => {
    const tracker = new ScrambleTracker("R2 U' F");
    tracker.apply("R");
    expect(tracker.view().steps[0]).toEqual({ text: "R", state: "current" });
    tracker.apply("R");
    expect(tracker.view().steps[0].state).toBe("done");
    tracker.apply("U'");
    tracker.apply("F");
    expect(tracker.done).toBe(true);
  });

  it("accepte R' R' pour R2", () => {
    const tracker = new ScrambleTracker("R2");
    tracker.apply("R'");
    tracker.apply("R'");
    expect(tracker.done).toBe(true);
  });

  it("dépassement sur la bonne face : il reste le complément", () => {
    const tracker = new ScrambleTracker("R U");
    tracker.apply("R'"); // voulait R
    expect(tracker.view().steps[0]).toEqual({ text: "R2", state: "current" });
  });

  it("mauvaise face : propose la correction puis reprend", () => {
    const tracker = new ScrambleTracker("R U");
    tracker.apply("L");
    tracker.apply("F'");
    expect(tracker.view().corrections).toEqual(["F", "L'"]);
    tracker.apply("F");
    tracker.apply("L'");
    expect(tracker.view().corrections).toEqual([]);
    tracker.apply("R");
    tracker.apply("U");
    expect(tracker.done).toBe(true);
  });
});

describe("SmartSession", () => {
  const scramble = "R U2 F' D L2";

  function setup(inspection: boolean) {
    const results: SmartResult[] = [];
    const session = new SmartSession({ inspection: () => inspection, onFinish: (r) => results.push(r) });
    let facelets = SOLVED;
    let t = 0;
    const turn = (move: string, cubeTimestamp: number | null = null) => {
      facelets = applyMove(facelets, move);
      t += 100;
      session.onMove({ move, timestamp: t, cubeTimestamp }, facelets);
    };
    return { session, results, turn, getFacelets: () => facelets, setT: (v: number) => (t = v) };
  }

  it("cycle complet : mélange → inspection → solve → résultat", () => {
    const { session, results, turn } = setup(true);
    session.setScramble(scramble, SOLVED);
    expect(session.state.name).toBe("scrambling");

    for (const m of quarterTurns(scramble)) turn(m);
    expect(session.state.name).toBe("inspecting");

    const solution = quarterTurns(invertAlg(scramble));
    turn(solution[0]);
    expect(session.state.name).toBe("running");
    for (const m of solution.slice(1)) turn(m);

    expect(session.state.name).toBe("needSolve");
    expect(results).toHaveLength(1);
    expect(results[0].penalty).toBe("none");
    expect(results[0].scramble).toBe(scramble);
    expect(results[0].moves).toHaveLength(solution.length);
    expect(results[0].timeMs).toBe((solution.length - 1) * 100);
  });

  it("sans inspection : attend le premier mouvement", () => {
    const { session, turn } = setup(false);
    session.setScramble(scramble, SOLVED);
    for (const m of quarterTurns(scramble)) turn(m);
    expect(session.state.name).toBe("waiting");
  });

  it("cube pas résolu au départ : demande de le résoudre", () => {
    const { session } = setup(true);
    session.setScramble(scramble, applyMove(SOLVED, "R"));
    expect(session.state.name).toBe("needSolve");
  });

  it("revient au début du mélange si le cube redevient résolu", () => {
    const { session, turn } = setup(true);
    session.setScramble(scramble, SOLVED);
    turn("R");
    turn("R'");
    expect(session.state.name).toBe("scrambling");
    if (session.state.name === "scrambling") expect(session.state.tracker.view().steps[0].state).toBe("current");
  });

  it("pénalité +2 si l'inspection dépasse 15 s", () => {
    const { session, results, turn, setT } = setup(true);
    session.setScramble(scramble, SOLVED);
    const scrambleMoves = quarterTurns(scramble);
    for (const m of scrambleMoves) turn(m);
    // L'inspection démarre au dernier mouvement du mélange (t = n × 100).
    const inspectionStart = scrambleMoves.length * 100;
    // Le prochain mouvement arrivera 16 s après (turn() ajoute 100 ms).
    setT(inspectionStart + 16_000 - 100);
    for (const m of quarterTurns(invertAlg(scramble))) turn(m);
    expect(results[0]?.penalty).toBe("+2");
  });

  it("solveDuration préfère l'horloge du cube", () => {
    expect(
      solveDuration([
        { move: "R", timestamp: 1000, cubeTimestamp: 50 },
        { move: "U", timestamp: 9000, cubeTimestamp: 7950 },
      ]),
    ).toBe(7900);
    expect(
      solveDuration([
        { move: "R", timestamp: 1000, cubeTimestamp: null },
        { move: "U", timestamp: 9000, cubeTimestamp: 100 },
      ]),
    ).toBe(8000);
  });
});
