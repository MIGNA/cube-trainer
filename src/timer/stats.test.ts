import { describe, expect, it } from "vitest";
import type { Penalty } from "../storage/db";
import { formatTime } from "./format";
import { averageOf, bestAverage, bestSingle, effectiveTime, meanOf, rollingAverages, trimCount } from "./stats";

const s = (sec: number, penalty: Penalty = "none") => ({ timeMs: sec * 1000, penalty });

describe("effectiveTime", () => {
  it("applique +2 et DNF", () => {
    expect(effectiveTime(s(10))).toBe(10_000);
    expect(effectiveTime(s(10, "+2"))).toBe(12_000);
    expect(effectiveTime(s(10, "DNF"))).toBe(Infinity);
  });
});

describe("averageOf", () => {
  it("renvoie null s'il n'y a pas assez de solves", () => {
    expect(averageOf([s(10), s(11)], 5)).toBeNull();
  });

  it("ao5 : retire le meilleur et le pire", () => {
    // retire 8 et 20 → (10 + 11 + 12) / 3 = 11
    expect(averageOf([s(10), s(20), s(11), s(8), s(12)], 5)).toBe(11_000);
  });

  it("ne prend que les n derniers solves", () => {
    expect(averageOf([s(99), s(10), s(20), s(11), s(8), s(12)], 5)).toBe(11_000);
  });

  it("un DNF compte comme le pire temps et est retiré", () => {
    expect(averageOf([s(10), s(10, "DNF"), s(11), s(8), s(12)], 5)).toBe(11_000);
  });

  it("deux DNF dans un ao5 → DNF", () => {
    expect(averageOf([s(10, "DNF"), s(10, "DNF"), s(11), s(8), s(12)], 5)).toBe(Infinity);
  });

  it("ao12 : retire 1 temps de chaque côté", () => {
    expect(trimCount(12)).toBe(1);
    const solves = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 100].map((t) => s(t));
    // retire 1 et 100 → moyenne de 2..11 = 6.5
    expect(averageOf(solves, 12)).toBe(6_500);
  });

  it("prend en compte les +2", () => {
    // 10 +2 = 12 ; retire 8 et 20 → (11 + 12 + 12) / 3
    expect(averageOf([s(10, "+2"), s(20), s(11), s(8), s(12)], 5)).toBeCloseTo(35_000 / 3);
  });
});

describe("meanOf / bestSingle / bestAverage", () => {
  it("meanOf", () => {
    expect(meanOf([])).toBeNull();
    expect(meanOf([s(10), s(12)])).toBe(11_000);
    expect(meanOf([s(10), s(12, "DNF")])).toBe(Infinity);
  });

  it("bestSingle ignore les DNF", () => {
    expect(bestSingle([])).toBeNull();
    expect(bestSingle([s(10, "DNF"), s(12), s(11)])).toBe(11_000);
  });

  it("bestAverage parcourt toutes les fenêtres", () => {
    const solves = [20, 20, 20, 20, 20, 10, 10, 10, 10, 10].map((t) => s(t));
    expect(bestAverage(solves, 5)).toBe(10_000);
    expect(bestAverage(solves.slice(0, 4), 5)).toBeNull();
  });

  it("rollingAverages", () => {
    const solves = [10, 10, 10, 10, 10, 20].map((t) => s(t));
    expect(rollingAverages(solves, 5)).toEqual([null, null, null, null, 10_000, 10_000]);
  });
});

describe("formatTime", () => {
  it("formate secondes et minutes, tronque au centième", () => {
    expect(formatTime(9_876)).toBe("9.87");
    expect(formatTime(9_879)).toBe("9.87");
    expect(formatTime(62_350)).toBe("1:02.35");
    expect(formatTime(0)).toBe("0.00");
  });

  it("gère DNF et valeur absente", () => {
    expect(formatTime(Infinity)).toBe("DNF");
    expect(formatTime(null)).toBe("—");
  });
});
