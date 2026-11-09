import { describe, expect, it } from "vitest";
import { randomMoveScramble } from "./scramble";
import { HOLD_MS, TimerMachine, inspectionPenalty, type TimerResult } from "./timer-machine";

function setup(inspection: boolean) {
  const results: TimerResult[] = [];
  const timer = new TimerMachine({ inspection: () => inspection, onFinish: (r) => results.push(r) });
  return { timer, results };
}

describe("TimerMachine sans inspection", () => {
  it("maintien → prêt → relâche démarre → appui arrête", () => {
    const { timer, results } = setup(false);
    timer.press(0);
    timer.tick(HOLD_MS - 1);
    expect(timer.state.name).toBe("holding");
    timer.tick(HOLD_MS);
    expect(timer.state.name).toBe("ready");
    timer.release(400);
    expect(timer.state.name).toBe("running");
    timer.press(10_400);
    expect(timer.state.name).toBe("idle");
    expect(results).toEqual([{ timeMs: 10_000, penalty: "none" }]);
  });

  it("relâcher trop tôt annule", () => {
    const { timer } = setup(false);
    timer.press(0);
    timer.tick(100);
    timer.release(100);
    expect(timer.state.name).toBe("idle");
  });

  it("le relâchement après l'arrêt ne relance rien", () => {
    const { timer } = setup(false);
    timer.press(0);
    timer.tick(HOLD_MS);
    timer.release(HOLD_MS);
    timer.press(5_000);
    timer.release(5_100);
    expect(timer.state.name).toBe("idle");
  });
});

describe("TimerMachine avec inspection", () => {
  it("un tap lance l'inspection, puis maintien → départ", () => {
    const { timer, results } = setup(true);
    timer.press(0);
    timer.tick(HOLD_MS + 100); // maintenir au repos ne suffit pas
    expect(timer.state.name).toBe("holding");
    timer.release(500);
    expect(timer.state.name).toBe("inspecting");

    timer.press(5_000);
    timer.tick(5_000 + HOLD_MS);
    expect(timer.state.name).toBe("ready");
    timer.release(5_500);
    timer.press(15_500);
    expect(results).toEqual([{ timeMs: 10_000, penalty: "none" }]);
  });

  it("relâcher trop tôt pendant l'inspection la poursuit", () => {
    const { timer } = setup(true);
    timer.press(0);
    timer.release(50);
    timer.press(1_000);
    timer.release(1_100);
    expect(timer.state).toEqual({ name: "inspecting", startedAt: 50 });
  });

  it("pénalités d'inspection WCA", () => {
    expect(inspectionPenalty(null, 99_000)).toBe("none");
    expect(inspectionPenalty(0, 15_000)).toBe("none");
    expect(inspectionPenalty(0, 15_001)).toBe("+2");
    expect(inspectionPenalty(0, 17_001)).toBe("DNF");
  });
});

describe("randomMoveScramble", () => {
  it("produit 20 mouvements sans face répétée ni R L R", () => {
    for (let i = 0; i < 200; i++) {
      const moves = randomMoveScramble().split(" ");
      expect(moves).toHaveLength(20);
      const faces = moves.map((m) => m[0]);
      for (let j = 1; j < faces.length; j++) {
        expect(faces[j]).not.toBe(faces[j - 1]);
        if (j >= 2) {
          const sameAxis = "UDRLFB".indexOf(faces[j]) >> 1 === "UDRLFB".indexOf(faces[j - 1]) >> 1;
          if (sameAxis) expect(faces[j]).not.toBe(faces[j - 2]);
        }
      }
    }
  });
});
