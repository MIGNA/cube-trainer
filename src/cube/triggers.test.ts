import { describe, expect, it } from "vitest";
import { findTriggers } from "./triggers";

/** Résumé lisible : triggers entre crochets avec leur id. */
const summary = (alg: string) =>
  findTriggers(alg)
    .map((s) => (s.trigger ? `[${s.trigger.id}${s.left ? "-g" : ""}: ${s.moves.join(" ")}]` : s.moves.join(" ")))
    .join(" ");

describe("findTriggers", () => {
  it("repère les triggers de base", () => {
    expect(summary("F R U R' U' F'")).toBe("F [sexy: R U R' U'] F'");
    expect(summary("R U R' U' R' F R F'")).toBe("[sexy: R U R' U'] [sledge: R' F R F']");
    expect(summary("R U R' U R U2 R'")).toBe("[sune: R U R' U R U2 R']");
    expect(summary("R U2 R' U' R U' R'")).toBe("[antisune: R U2 R' U' R U' R']");
  });

  it("préfère le trigger le plus long", () => {
    expect(summary("R U R' U R U2 R' U'")).toBe("[sune: R U R' U R U2 R'] U'");
  });

  it("reconnaît la version main gauche", () => {
    expect(summary("F' L' U' L U F")).toBe("F' [sexy-g: L' U' L U] F");
    expect(summary("L' U' L U' L' U2 L")).toBe("[sune-g: L' U' L U' L' U2 L]");
  });

  it("accepte mouvements larges, Rw, parenthèses et U2'", () => {
    expect(summary("f R U R' U' f'")).toBe("f [sexy: R U R' U'] f'");
    expect(summary("r U R' U' r' F R F'")).toBe("[sexy: r U R' U'] [sledge: r' F R F']");
    expect(summary("(Rw U R' U') M")).toBe("[sexy: (Rw U R' U')] M");
    expect(summary("R U2' R' U' R U' R'")).toBe("[antisune: R U2' R' U' R U' R']");
  });

  it("garde la formule intacte", () => {
    const alg = "R U R' U' M' U R U' r'";
    expect(findTriggers(alg).flatMap((s) => s.moves).join(" ")).toBe(alg);
  });

  it("formule sans trigger", () => {
    expect(summary("M2 U M2 U2 M2 U M2")).toBe("M2 U M2 U2 M2 U M2");
    expect(findTriggers("")).toEqual([]);
  });
});
