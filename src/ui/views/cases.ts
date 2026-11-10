// Onglet Algos (#/algos, #/algos/<id du cas>) : les 21 PLL et 57 OLL avec schéma, nom,
// algo et état d'apprentissage (non appris → à travailler → su, en touchant la carte).
// L'entraînement (étapes 5-7) piochera dans les cas « à travailler ».

import type { View } from "../../app/router";
import { caseView } from "../../cube/case-diagram";
import { OLL_CASES, PLL_CASES, type CaseDef } from "../../cube/cases";
import { getSetting, setSetting, type CaseStatus } from "../../storage/settings";
import { caseSvg } from "../case-svg";
import { h } from "../dom";

/** Lien vers la fiche d'un cas ("T", "OLL 27"…). */
export const algoHref = (id: string) => `#/algos/${encodeURIComponent(id)}`;

const NEXT: Record<CaseStatus, CaseStatus> = { new: "learning", learning: "known", known: "new" };
const LABEL: Record<CaseStatus, string> = { new: "non appris", learning: "à travailler", known: "su" };

type Filter = "all" | CaseStatus;
const FILTERS: [Filter, string][] = [
  ["all", "Tous"],
  ["learning", "À travailler"],
  ["known", "Sus"],
  ["new", "Non appris"],
];

export const casesView: View = {
  title: "Algos",
  mount(container, params) {
    const target = params[0] ? decodeURIComponent(params[0]) : null;
    let statuses: Record<string, CaseStatus> = {};
    let filter: Filter = "all";
    const status = (id: string): CaseStatus => statuses[id] ?? "new";

    const cards = new Map<string, HTMLElement>();
    function card(c: CaseDef, kind: "oll" | "pll"): HTMLElement {
      const title = kind === "oll" ? c.id.replace("OLL ", "") : `${c.id}-perm`;
      const name = kind === "oll" && c.name !== title ? c.name : "";
      const badge = h("span", { class: "case-badge" });
      const el = h(
        "button",
        { class: "case-card", title: "Toucher pour changer l'état", onclick: () => void cycle(c.id) },
        h("strong", {}, title),
        name ? h("small", { class: "muted" }, name) : null,
        h("code", { class: "case-alg" }, c.alg),
        badge,
      );
      el.prepend(caseSvg(caseView(c.alg), kind));
      if (c.id === target) el.classList.add("target");
      cards.set(c.id, el);
      return el;
    }

    const counts = { pll: h("span", { class: "case-count" }), oll: h("span", { class: "case-count" }) };
    const filterBtns = FILTERS.map(([f, label]) => h("button", { class: "secondary", onclick: () => ((filter = f), refresh()) }, label));

    function refresh(): void {
      for (const [id, el] of cards) {
        const s = status(id);
        el.classList.toggle("learning", s === "learning");
        el.classList.toggle("known", s === "known");
        el.querySelector(".case-badge")!.textContent = LABEL[s];
        el.hidden = filter !== "all" && filter !== s;
      }
      filterBtns.forEach((b, i) => b.classList.toggle("selected", FILTERS[i][0] === filter));
      const known = (list: CaseDef[]) => list.filter((c) => status(c.id) === "known").length;
      const learning = (list: CaseDef[]) => list.filter((c) => status(c.id) === "learning").length;
      counts.pll.textContent = ` · ${known(PLL_CASES)} sus, ${learning(PLL_CASES)} à travailler`;
      counts.oll.textContent = ` · ${known(OLL_CASES)} sus, ${learning(OLL_CASES)} à travailler`;
    }

    async function cycle(id: string): Promise<void> {
      const next = NEXT[status(id)];
      statuses = { ...statuses };
      if (next === "new") delete statuses[id];
      else statuses[id] = next;
      refresh();
      await setSetting("caseStatus", statuses);
    }

    container.append(
      h("h1", {}, "Algos"),
      h(
        "p",
        { class: "muted small" },
        "Dernière couche en haut (jaune), face verte devant. Les flèches montrent où va chaque pièce. Touche un cas pour changer son état : non appris → à travailler → su.",
      ),
      h("div", { class: "case-filters" }, ...filterBtns),
      h("section", { class: "card" }, h("h2", {}, `PLL (${PLL_CASES.length})`, counts.pll), h("div", { class: "case-grid" }, ...PLL_CASES.map((c) => card(c, "pll")))),
      h("section", { class: "card" }, h("h2", {}, `OLL (${OLL_CASES.length})`, counts.oll), h("div", { class: "case-grid" }, ...OLL_CASES.map((c) => card(c, "oll")))),
    );
    refresh();
    if (target) cards.get(target)?.scrollIntoView({ block: "center" });

    void getSetting("caseStatus").then((saved) => {
      statuses = saved;
      refresh();
    });
  },
};
