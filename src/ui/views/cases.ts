// Onglet Algos :
// - #/algos : catalogue des 21 PLL et 57 OLL (schéma, nom, algo entraîné, état) ;
// - #/algos/<id> : fiche d'un cas (état d'apprentissage, set-up, mes algos, suggestions, ajout d'un algo).
// L'entraînement (étapes 5-7) piochera dans les cas « à travailler » avec l'algo choisi ici.

import type { View } from "../../app/router";
import { caseView } from "../../cube/case-diagram";
import { findCase, mainAlg, myAlgs, suggestedAlgs, withMain, without } from "../../cube/case-algs";
import { OLL_CASES, PLL_CASES, checkCaseAlg, type CaseDef } from "../../cube/cases";
import { getSetting, setSetting, type CaseStatus } from "../../storage/settings";
import { caseSvg } from "../case-svg";
import { setupPanel } from "../setup-panel";
import { h } from "../dom";

/** Lien vers la fiche d'un cas ("T", "OLL 27"…). */
export const algoHref = (id: string) => `#/algos/${encodeURIComponent(id)}`;

const LABEL: Record<CaseStatus, string> = { new: "non appris", learning: "à travailler", known: "maîtrisé" };
const STATUSES: CaseStatus[] = ["new", "learning", "known"];

type Filter = "all" | CaseStatus;
const FILTERS: [Filter, string][] = [
  ["all", "Tous"],
  ["learning", "À travailler"],
  ["known", "Maîtrisés"],
  ["new", "Non appris"],
];

const kindOf = (c: CaseDef): "oll" | "pll" => (OLL_CASES.includes(c) ? "oll" : "pll");
const titleOf = (c: CaseDef) => (kindOf(c) === "oll" ? c.id.replace("OLL ", "") : `${c.id}-perm`);
const subtitleOf = (c: CaseDef) => (kindOf(c) === "oll" && c.name !== titleOf(c) ? c.name : "");

// Dernier cas ouvert : le catalogue y revient en quittant la fiche.
let lastViewed: string | null = null;

export const casesView: View = {
  title: "Algos",
  mount(container, params) {
    const c = params[0] ? findCase(decodeURIComponent(params[0])) : undefined;
    if (c) return mountCase(container, c);
    mountCatalogue(container);
  },
};

// --- Catalogue ------------------------------------------------------------

function mountCatalogue(container: HTMLElement): void {
  let statuses: Record<string, CaseStatus> = {};
  let algs: Record<string, string[]> = {};
  let filter: Filter = "all";
  const status = (id: string): CaseStatus => statuses[id] ?? "new";

  const cards = new Map<string, HTMLElement>();
  function card(c: CaseDef): HTMLElement {
    const sub = subtitleOf(c);
    const el = h(
      "a",
      { class: "case-card", href: algoHref(c.id) },
      caseSvg(caseView(c.alg), kindOf(c)),
      h("strong", {}, titleOf(c)),
      sub ? h("small", { class: "muted" }, sub) : null,
      h("code", { class: "case-alg" }),
      h("span", { class: "case-badge" }),
    );
    if (c.id === lastViewed) el.classList.add("target");
    cards.set(c.id, el);
    return el;
  }

  const counts = { pll: h("span", { class: "case-count" }), oll: h("span", { class: "case-count" }) };
  const filterBtns = FILTERS.map(([f, label]) => h("button", { class: "secondary", onclick: () => ((filter = f), refresh()) }, label));

  function refresh(): void {
    for (const c of [...PLL_CASES, ...OLL_CASES]) {
      const el = cards.get(c.id)!;
      const s = status(c.id);
      el.classList.toggle("learning", s === "learning");
      el.classList.toggle("known", s === "known");
      el.querySelector(".case-badge")!.textContent = LABEL[s];
      el.querySelector(".case-alg")!.textContent = mainAlg(c, algs);
      el.hidden = filter !== "all" && filter !== s;
    }
    filterBtns.forEach((b, i) => b.classList.toggle("selected", FILTERS[i][0] === filter));
    const count = (list: CaseDef[], s: CaseStatus) => list.filter((c) => status(c.id) === s).length;
    counts.pll.textContent = ` · ${count(PLL_CASES, "known")} maîtrisés, ${count(PLL_CASES, "learning")} à travailler`;
    counts.oll.textContent = ` · ${count(OLL_CASES, "known")} maîtrisés, ${count(OLL_CASES, "learning")} à travailler`;
  }

  container.append(
    h("h1", {}, "Algos"),
    h(
      "p",
      { class: "muted small" },
      "Dernière couche en haut (jaune), face verte devant. Les flèches montrent où va chaque pièce. Touche un cas pour choisir ton algo et son état.",
    ),
    h("div", { class: "case-filters" }, ...filterBtns),
    h("section", { class: "card" }, h("h2", {}, `PLL (${PLL_CASES.length})`, counts.pll), h("div", { class: "case-grid" }, ...PLL_CASES.map(card))),
    h("section", { class: "card" }, h("h2", {}, `OLL (${OLL_CASES.length})`, counts.oll), h("div", { class: "case-grid" }, ...OLL_CASES.map(card))),
  );
  refresh();
  if (lastViewed) cards.get(lastViewed)?.scrollIntoView({ block: "center" });

  void Promise.all([getSetting("caseStatus"), getSetting("caseAlgs")]).then(([s, a]) => {
    statuses = s;
    algs = a;
    refresh();
  });
}

// --- Fiche d'un cas -------------------------------------------------------

function mountCase(container: HTMLElement, c: CaseDef): () => void {
  lastViewed = c.id;
  let statuses: Record<string, CaseStatus> = {};
  let algs: Record<string, string[]> = {};
  const list = () => myAlgs(c, algs);

  async function saveStatus(s: CaseStatus): Promise<void> {
    statuses = { ...statuses };
    if (s === "new") delete statuses[c.id];
    else statuses[c.id] = s;
    refresh();
    await setSetting("caseStatus", statuses);
  }

  async function saveAlgs(next: string[]): Promise<void> {
    algs = { ...algs };
    // L'algo standard seul = valeur par défaut, inutile de la stocker.
    if (next.length === 1 && next[0] === c.alg) delete algs[c.id];
    else algs[c.id] = next;
    refresh();
    await setSetting("caseAlgs", algs);
  }

  const setup = setupPanel(c);
  const statusBtns = STATUSES.map((s) => h("button", { class: "secondary", onclick: () => void saveStatus(s) }, LABEL[s]));
  const mine = h("div", { class: "alg-list" });
  const suggestions = h("div", { class: "alg-list" });
  const suggestionsCard = h("section", { class: "card" }, h("h2", {}, "Suggestions"), suggestions);

  const input = h("input", {
    type: "text",
    placeholder: "ex. R U R' U' …",
    autocapitalize: "off",
    autocomplete: "off",
  }) as HTMLInputElement;
  input.spellcheck = false;
  const message = h("p", { class: "status" });
  function addCustom(): void {
    const result = checkCaseAlg(c, input.value);
    message.classList.toggle("ok", result.ok);
    message.classList.toggle("err", !result.ok);
    if (!result.ok) {
      message.textContent = result.error;
      return;
    }
    message.textContent = "Algo vérifié et choisi ✓";
    input.value = "";
    void saveAlgs(withMain(list(), result.alg));
  }

  function row(alg: string, ...actions: (HTMLElement | null)[]): HTMLElement {
    return h("div", { class: "alg-row" }, h("code", {}, alg), h("div", { class: "alg-actions" }, ...actions));
  }

  function refresh(): void {
    const s = statuses[c.id] ?? "new";
    statusBtns.forEach((b, i) => b.classList.toggle("selected", STATUSES[i] === s));

    const current = list();
    setup.refresh([...current, ...suggestedAlgs(c)]);
    mine.replaceChildren(
      ...current.map((alg, i) =>
        i === 0
          ? row(alg, h("span", { class: "alg-main" }, "★ entraîné"), current.length > 1 ? removeBtn(alg) : null)
          : row(alg, h("button", { class: "secondary", onclick: () => void saveAlgs(withMain(current, alg)) }, "Entraîner"), removeBtn(alg)),
      ),
    );
    const others = suggestedAlgs(c).filter((a) => !current.includes(a));
    suggestions.replaceChildren(...others.map((alg) => row(alg, h("button", { class: "secondary", onclick: () => void saveAlgs(withMain(current, alg)) }, "Choisir"))));
    suggestionsCard.hidden = others.length === 0;
  }

  function removeBtn(alg: string): HTMLElement {
    return h("button", { class: "secondary", title: "Retirer de mes algos", onclick: () => void saveAlgs(without(list(), alg)) }, "✕");
  }

  const sub = subtitleOf(c);
  container.append(
    h("a", { href: "#/algos", class: "back" }, "‹ Algos"),
    h(
      "section",
      { class: "card case-head" },
      caseSvg(caseView(c.alg), kindOf(c), 140),
      h("div", {}, h("h1", {}, titleOf(c)), sub ? h("p", { class: "muted" }, sub) : null, h("div", { class: "case-filters" }, ...statusBtns)),
    ),
    setup.el,
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Mes algos"),
      h("p", { class: "muted small" }, "Le premier (★) est celui que tu entraînes."),
      mine,
    ),
    suggestionsCard,
    h(
      "section",
      { class: "card" },
      h("h2", {}, "Ajouter mon algo"),
      h("p", { class: "muted small" }, "Il est vérifié sur le cube virtuel : il doit résoudre ce cas sans casser les deux premières couches. AUF, rotations (x y z) et mouvements larges (r, Rw, M) acceptés."),
      h(
        "form",
        { class: "alg-form", onsubmit: (e: Event) => (e.preventDefault(), addCustom()) },
        input,
        h("button", { type: "submit" }, "Vérifier"),
      ),
      message,
    ),
  );
  refresh();

  void Promise.all([getSetting("caseStatus"), getSetting("caseAlgs")]).then(([s, a]) => {
    statuses = s;
    algs = a;
    refresh();
  });
  return () => setup.destroy();
}
