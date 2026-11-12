// Synthèse de la méthode débutant (ensemble « Débutant » de l'onglet Algos) :
// les étapes dans l'ordre, chaque formule avec ses triggers et son histoire.
// Pas d'état d'apprentissage ni de set-up : simple aide-mémoire.

import { BEGINNER_STEPS, casePicture, type BeginnerAlg, type BeginnerStep } from "../cube/beginner";
import { caseView, permutationView } from "../cube/case-diagram";
import { parseAnyAlg, formatMove } from "../cube/facelets";
import { describeMove } from "../cube/move-names";
import { algView } from "./alg-view";
import { moveSvg, stateSvg } from "./move-svg";
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

/** Image du cas : vue de dessus (dernière couche) ou petit cube 3D (étapes 1 et 2). */
function picture(a: BeginnerAlg): SVGSVGElement | null {
  const size = 64;
  if (a.diagram === "eo") return caseSvg(caseView(a.alg), "eo", size);
  if (a.diagram === "orient") return caseSvg(caseView(a.alg), "oll", size);
  if (a.diagram) return caseSvg(permutationView(a.alg), "pll", size, a.diagram);
  const p = casePicture(a);
  return p ? stateSvg(p.state, p.emphasis, size) : null;
}

function algBlock(a: BeginnerAlg): HTMLElement {
  const moves = parseAnyAlg(a.alg).map(formatMove);
  return h(
    "div",
    { class: "beginner-alg" },
    h(
      "div",
      { class: "beginner-alg-head" },
      picture(a),
      h(
        "div",
        {},
        h("strong", {}, a.name),
        h("p", { class: "muted small" }, a.when),
        algView(a.alg, { interactive: true, class: "beginner-formula" }),
        a.why ? h("p", { class: "small beginner-why" }, a.why) : null,
      ),
    ),
    // Histoire : d'abord les personnages, puis l'histoire d'un trait, puis le détail.
    a.characters
      ? h("div", { class: "beginner-tale" }, h("h3", {}, "Les personnages"), h("ul", {}, ...a.characters.map((c) => h("li", {}, c))))
      : null,
    a.tale ? h("div", { class: "beginner-tale" }, h("h3", {}, "L'histoire"), h("p", {}, a.tale)) : null,
    a.tale ? h("h3", { class: "beginner-detail" }, "Le détail, geste par geste") : null,
    // Chaque mouvement traduit en français, avec la ligne de l'histoire s'il y en a une.
    h(
      "ol",
      { class: "beginner-moves" },
      ...moves.map((m, i) =>
        h(
          "li",
          {},
          h("code", {}, m),
          h("span", {}, describeMove(m) ?? m),
          a.story ? h("em", {}, a.story[i]) : null,
        ),
      ),
    ),
    // Puis la série des petits dessins, dans l'ordre.
    h(
      "div",
      { class: "beginner-drawings", "aria-hidden": "true" },
      ...moves.map((m) => h("figure", {}, moveSvg(m, 46), h("figcaption", {}, m))),
    ),
  );
}

// Étapes ouvertes, retenues d'une visite à l'autre (préférence de cet appareil).
// Par défaut tout est replié : on voit la liste des étapes d'un coup d'œil.
const OPEN_KEY = "debutant-etapes-ouvertes";

function loadOpen(): Set<string> {
  try {
    const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function saveOpen(open: Set<string>): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...open]));
  } catch {
    // pas grave : l'état ne sera simplement pas retenu
  }
}

function stepCard(step: BeginnerStep, open: Set<string>): HTMLElement {
  const el = h(
    "details",
    { class: "card case-block beginner-step" },
    h("summary", {}, h("h2", {}, step.title)),
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
  ) as HTMLDetailsElement;
  el.open = open.has(step.title);
  el.addEventListener("toggle", () => {
    if (el.open) open.add(step.title);
    else open.delete(step.title);
    saveOpen(open);
  });
  return el;
}

export function beginnerSummary(): HTMLElement {
  const open = loadOpen();
  return h(
    "div",
    { class: "beginner" },
    h("p", { class: "muted small" }, "Méthode couche par couche. Touche un passage souligné pour voir le nom du trigger."),
    h(
      "p",
      { class: "small beginner-intro" },
      "Plutôt que d'apprendre une suite de lettres, on retient une petite histoire : chaque phrase correspond à un geste. On raconte l'histoire, et les mains suivent.",
    ),
    ...BEGINNER_STEPS.map((step) => stepCard(step, open)),
  );
}
