// Contenu de la notation : ce que veut dire chaque lettre d'un algo, avec un dessin
// fixe par mouvement (voir src/ui/move-svg.ts). Affiché par-dessus la page courante
// (src/ui/notation-sheet.ts).

import { h } from "../dom";
import { moveSvg } from "../move-svg";

type Item = [move: string, text: string];

const SECTIONS: { title: string; intro: string; items: Item[] }[] = [
  {
    title: "Les faces",
    intro: "Chaque lettre tourne une face d'un quart de tour, dans le sens des aiguilles d'une montre quand on regarde cette face en face.",
    items: [
      ["R", "Droite (Right) : l'avant monte."],
      ["L", "Gauche (Left) : l'avant descend."],
      ["U", "Haut (Up) : l'avant part à gauche."],
      ["D", "Bas (Down) : l'avant part à droite."],
      ["F", "Avant (Front) : le haut part à droite."],
      ["B", "Arrière (Back) : le haut part à gauche."],
    ],
  },
  {
    title: "Le sens",
    intro: "Une apostrophe inverse le sens, un 2 fait un demi-tour.",
    items: [
      ["R", "Quart de tour, sens horaire."],
      ["R'", "« R prime » : quart de tour dans l'autre sens."],
      ["R2", "Demi-tour (le sens n'a pas d'importance)."],
    ],
  },
  {
    title: "Mouvements larges",
    intro: "En minuscule (ou avec un w), on tourne la face et la tranche du milieu ensemble. Pareil pour l, u, d, f, b.",
    items: [
      ["r", "= Rw : deux couches de droite, comme R."],
      ["l", "= Lw : deux couches de gauche, comme L."],
      ["f", "= Fw : deux couches avant, comme F."],
    ],
  },
  {
    title: "Tranches du milieu",
    intro: "Seule la tranche du milieu tourne ; les centres changent de place.",
    items: [
      ["M", "Entre L et R, dans le sens de L."],
      ["E", "Entre U et D, dans le sens de D."],
      ["S", "Entre F et B, dans le sens de F."],
    ],
  },
  {
    title: "Rotations du cube",
    intro: "Tout le cube tourne dans la main : rien ne se mélange, on change juste de point de vue.",
    items: [
      ["x", "Comme R : l'avant passe en haut."],
      ["y", "Comme U : la droite passe devant."],
      ["z", "Comme F : le haut passe à droite."],
    ],
  },
];

function card([move, text]: Item): HTMLElement {
  return h("figure", { class: "move-card" }, moveSvg(move), h("figcaption", {}, h("code", {}, move), h("small", { class: "muted" }, text)));
}

export function notationContent(): HTMLElement[] {
  return [
    h(
      "div",
      { class: "muted small setup-hold" },
      h("p", {}, h("i", { class: "hold-swatch yellow", "aria-hidden": "true" }), "jaune en haut,"),
      h("p", {}, h("i", { class: "hold-swatch green", "aria-hidden": "true" }), "vert devant : comme sur les schémas des cas."),
    ),
    h("p", { class: "muted small" }, "Sur les dessins, ce qui tourne est en couleur, le reste est estompé ; la flèche montre le sens."),
    ...SECTIONS.map((s) =>
      h("section", { class: "card" }, h("h2", {}, s.title), h("p", { class: "muted small" }, s.intro), h("div", { class: "move-grid" }, ...s.items.map(card))),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Vocabulaire"),
      h(
        "dl",
        { class: "notation-terms" },
        h("dt", {}, "AUF"),
        h("dd", {}, "« Adjust U Face » : tourner la face du haut (U, U' ou U2) pour placer le cas avant l'algo, ou finir le cube après."),
        h("dt", {}, "( )"),
        h("dd", {}, "Les parenthèses regroupent des mouvements qui s'enchaînent d'un geste ; elles ne changent rien à l'algo."),
      ),
    ),
  ];
}
