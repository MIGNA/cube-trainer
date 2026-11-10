// Synthèse de la méthode débutant (ensemble « Débutant » de l'onglet Algos) :
// les étapes dans l'ordre, chaque formule avec ses triggers et son histoire.
// Pas d'état d'apprentissage ni de set-up : simple aide-mémoire.

import { BEGINNER_SOURCE, BEGINNER_STEPS, type BeginnerAlg, type BeginnerStep } from "../cube/beginner";
import { caseView } from "../cube/case-diagram";
import { parseAnyAlg, formatMove } from "../cube/facelets";
import { algView } from "./alg-view";
import { COLORS, caseSvg } from "./case-svg";
import { h } from "./dom";

const NS = "http://www.w3.org/2000/svg";

/** Marguerite vue de dessus : centre jaune, pétales blancs, coins gris. */
function daisySvg(): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 30 30");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");
  svg.setAttribute("class", "case-svg");
  for (let i = 0; i < 9; i++) {
    const r = document.createElementNS(NS, "rect");
    const fill = i === 4 ? COLORS.U : i % 2 === 1 ? COLORS.D : "#4a525e";
    for (const [k, v] of Object.entries({ x: (i % 3) * 10 + 0.5, y: Math.floor(i / 3) * 10 + 0.5, width: 9, height: 9, rx: 1.2, fill })) r.setAttribute(k, String(v));
    svg.append(r);
  }
  return svg;
}

function algBlock(a: BeginnerAlg): HTMLElement {
  const moves = parseAnyAlg(a.alg).map(formatMove);
  return h(
    "div",
    { class: "beginner-alg" },
    h(
      "div",
      { class: "beginner-alg-head" },
      a.diagram ? caseSvg(caseView(a.alg), a.diagram, 56) : null,
      h("div", {}, h("strong", {}, a.name), h("p", { class: "muted small" }, a.when), algView(a.alg, { interactive: true, class: "beginner-formula" })),
    ),
    a.story
      ? h(
          "ol",
          { class: "beginner-story" },
          ...a.story.map((line, i) => h("li", {}, h("code", {}, moves[i]), " ", line)),
        )
      : null,
  );
}

function stepCard(step: BeginnerStep): HTMLElement {
  return h(
    "section",
    { class: "card beginner-step" },
    h("h2", {}, step.title),
    h("p", {}, step.goal),
    step.hold ? h("p", { class: "muted small" }, "🖐 ", step.hold) : null,
    step.daisy || step.text
      ? h(
          "div",
          { class: "beginner-text" },
          step.daisy ? daisySvg() : null,
          step.text ? h("ol", {}, ...step.text.map((t) => h("li", {}, t))) : null,
        )
      : null,
    ...step.algs.map(algBlock),
    ...(step.tips ?? []).map((t) => h("p", { class: "muted small beginner-tip" }, "💡 ", t)),
  );
}

export function beginnerSummary(): HTMLElement {
  return h(
    "div",
    { class: "beginner" },
    h(
      "p",
      { class: "muted small" },
      "Méthode couche par couche, d'après ",
      h("a", { href: BEGINNER_SOURCE, target: "_blank", rel: "noopener" }, "Francocube"),
      ". Touche un passage souligné pour voir le nom du trigger.",
    ),
    ...BEGINNER_STEPS.map(stepCard),
  );
}
