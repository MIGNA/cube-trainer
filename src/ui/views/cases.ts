// Catalogue des cas (#/cas) : les 57 OLL et 21 PLL avec schéma, nom et algo.
// Sert aussi à vérifier d'un coup d'œil que les noms correspondent aux bons cas.

import type { View } from "../../app/router";
import { caseView } from "../../cube/case-diagram";
import { OLL_CASES, PLL_CASES, type CaseDef } from "../../cube/cases";
import { caseSvg } from "../case-svg";
import { h } from "../dom";

function card(c: CaseDef, kind: "oll" | "pll"): HTMLElement {
  const title = kind === "oll" ? c.id.replace("OLL ", "") : `${c.id}-perm`;
  const name = kind === "oll" && c.name !== title ? c.name : "";
  const wrap = h("div", { class: "case-card" }, h("strong", {}, title), name ? h("small", { class: "muted" }, name) : null, h("code", { class: "case-alg" }, c.alg));
  wrap.prepend(caseSvg(caseView(c.alg), kind));
  return wrap;
}

export const casesView: View = {
  title: "Cas OLL / PLL",
  mount(container) {
    container.append(
      h("a", { href: "#/stats", class: "back" }, "‹ Stats"),
      h("h1", {}, "Cas OLL / PLL"),
      h(
        "p",
        { class: "muted small" },
        "Dernière couche en haut (jaune), face verte devant. Les flèches montrent où va chaque pièce. Si un nom ne correspond pas au schéma, signale-le !",
      ),
      h("section", { class: "card" }, h("h2", {}, `PLL (${PLL_CASES.length})`), h("div", { class: "case-grid" }, ...PLL_CASES.map((c) => card(c, "pll")))),
      h("section", { class: "card" }, h("h2", {}, `OLL (${OLL_CASES.length})`), h("div", { class: "case-grid" }, ...OLL_CASES.map((c) => card(c, "oll")))),
    );
  },
};
