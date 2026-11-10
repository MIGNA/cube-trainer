// Onglet Algos :
// - #/algos : catalogue par ensemble (CFOP : 21 PLL et 57 OLL ; 2-look ; débutant à venir),
//   filtrable par état (filtres combinables), en blocs OLL/PLL repliables ;
// - #/algos/notation : page Notation (voir notation.ts) ;
// - #/algos/<id> : fiche d'un cas (état d'apprentissage, set-up, mes algos, suggestions, ajout d'un algo).
// L'entraînement (étapes 5-7) piochera dans les cas « à travailler » avec l'algo choisi ici.

import type { View } from "../../app/router";
import { caseView } from "../../cube/case-diagram";
import { SET_CASES, findCase, mainAlg, myAlgs, suggestedAlgs, withMain, without, type AlgSet } from "../../cube/case-algs";
import { caseKind, checkCaseAlg, type CaseDef } from "../../cube/cases";
import { getSetting, setSetting, type CaseStatus } from "../../storage/settings";
import { caseSvg } from "../case-svg";
import { setupPanel } from "../setup-panel";
import { mountNotation } from "./notation";
import { h } from "../dom";

/** Lien vers la fiche d'un cas ("T", "OLL 27"…). */
export const algoHref = (id: string) => `#/algos/${encodeURIComponent(id)}`;

const LABEL: Record<CaseStatus, string> = { new: "non appris", learning: "à travailler", known: "maîtrisé" };
const STATUSES: CaseStatus[] = ["new", "learning", "known"];

// Filtres d'état combinables : on affiche les cas dont l'état est coché ; aucun coché = tous.
const FILTERS: [CaseStatus, string][] = [
  ["learning", "À travailler"],
  ["known", "Maîtrisés"],
  ["new", "Non appris"],
];
const SETS: [AlgSet, string][] = [
  ["cfop", "CFOP"],
  ["2look", "2-look"],
  ["beginner", "Débutant"],
];

// Choix d'affichage retenus d'une visite à l'autre (préférences de cet appareil).
type Block = "pll" | "oll";
interface Prefs {
  set: AlgSet;
  statuses: CaseStatus[];
  closed: Block[];
}
const PREFS_KEY = "algos-affichage";

function loadPrefs(): Prefs {
  const prefs: Prefs = { set: "cfop", statuses: [], closed: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    if (SETS.some(([s]) => s === saved.set)) prefs.set = saved.set!;
    if (Array.isArray(saved.statuses)) prefs.statuses = saved.statuses.filter((x) => STATUSES.includes(x));
    if (Array.isArray(saved.closed)) prefs.closed = saved.closed.filter((x) => x === "pll" || x === "oll");
  } catch {
    // stockage indisponible : valeurs par défaut
  }
  return prefs;
}

function savePrefs(prefs: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // pas grave : le choix ne sera simplement pas retenu
  }
}

const titleOf = (c: CaseDef) => ({ eo: c.name, oll: c.id.replace("OLL ", ""), pll: `${c.id}-perm` })[caseKind(c)];
const subtitleOf = (c: CaseDef) => {
  const kind = caseKind(c);
  if (kind === "eo") return "croix jaune";
  return kind === "oll" && c.name !== titleOf(c) ? c.name : "";
};

// Dernier cas ouvert : le catalogue y revient en quittant la fiche.
let lastViewed: string | null = null;

export const casesView: View = {
  title: "Algos",
  mount(container, params) {
    if (params[0] === "notation") return mountNotation(container);
    const c = params[0] ? findCase(decodeURIComponent(params[0])) : undefined;
    if (c) return mountCase(container, c);
    mountCatalogue(container);
  },
};

// --- Catalogue ------------------------------------------------------------

function mountCatalogue(container: HTMLElement): void {
  let statuses: Record<string, CaseStatus> = {};
  let algs: Record<string, string[]> = {};
  const prefs = loadPrefs();
  const active = new Set(prefs.statuses);
  const save = () => savePrefs({ ...prefs, statuses: [...active] });
  const status = (id: string): CaseStatus => statuses[id] ?? "new";

  const cards = new Map<string, HTMLElement>();
  function card(c: CaseDef): HTMLElement {
    const sub = subtitleOf(c);
    const el = h(
      "a",
      { class: "case-card", href: algoHref(c.id) },
      caseSvg(caseView(c.alg), caseKind(c)),
      h("strong", {}, titleOf(c)),
      sub ? h("small", { class: "muted" }, sub) : null,
      h("code", { class: "case-alg" }),
      h("span", { class: "case-badge" }),
    );
    if (c.id === lastViewed) el.classList.add("target");
    cards.set(c.id, el);
    return el;
  }

  const setFilters = (change: () => void) => {
    change();
    // Tout coché revient à ne rien filtrer : on rallume « Tous ».
    if (active.size === STATUSES.length) active.clear();
    save();
    refresh();
  };
  const setBtns = SETS.map(([s, label]) =>
    h("button", { class: "secondary", onclick: () => ((prefs.set = s), save(), build(), refresh()) }, label),
  );
  const allBtn = h("button", { class: "secondary", onclick: () => setFilters(() => active.clear()) }, "Tous");
  const filterBtns = FILTERS.map(([f, label]) => {
    const n = h("span", { class: "filter-count" });
    const btn = h(
      "button",
      { class: "secondary", onclick: () => setFilters(() => (active.has(f) ? active.delete(f) : active.add(f))) },
      label,
      " ",
      n,
    );
    return { f, btn, n };
  });

  // Blocs PLL et OLL repliables (ouverts par défaut, état retenu).
  const blocks = (["pll", "oll"] as Block[]).map((b) => {
    const title = h("span", {});
    const count = h("span", { class: "case-count" });
    const body = h("div", {});
    const empty = h("p", { class: "muted small" }, "Aucun cas avec ces filtres.");
    const el = h("details", { class: "card case-block" }, h("summary", {}, h("h2", {}, title, count)), body, empty) as HTMLDetailsElement;
    el.open = !prefs.closed.includes(b);
    el.addEventListener("toggle", () => {
      prefs.closed = el.open ? prefs.closed.filter((x) => x !== b) : [...new Set([...prefs.closed, b])];
      save();
    });
    return { b, el, title, count, body, empty, cases: [] as CaseDef[] };
  });
  const soon = h(
    "section",
    { class: "card" },
    h("h2", {}, "Méthode débutant"),
    h("p", { class: "muted" }, "Bientôt : la méthode couche par couche, avec un surnom pour chaque algo."),
  );

  // Contenu des blocs selon l'ensemble choisi.
  function build(): void {
    const set = SET_CASES[prefs.set];
    soon.hidden = prefs.set !== "beginner";
    for (const block of blocks) {
      const groups = set[block.b];
      block.cases = groups.flatMap((g) => g.cases);
      block.el.hidden = block.cases.length === 0;
      const name = block.b.toUpperCase() + (prefs.set === "2look" ? " 2-look" : "");
      block.title.textContent = `${name} (${block.cases.length})`;
      block.body.replaceChildren(
        ...groups.map((g) =>
          h(
            "div",
            { class: "case-group" },
            g.label ? h("h3", { class: "case-group-title" }, g.label) : null,
            g.hint ? h("p", { class: "muted small case-group-hint" }, g.hint) : null,
            h("div", { class: "case-grid" }, ...g.cases.map((c) => cards.get(c.id) ?? card(c))),
          ),
        ),
      );
    }
    setBtns.forEach((btn, i) => btn.classList.toggle("selected", SETS[i][0] === prefs.set));
  }

  function refresh(): void {
    const shown = (s: CaseStatus) => active.size === 0 || active.has(s);
    for (const block of blocks) {
      for (const c of block.cases) {
        const el = cards.get(c.id)!;
        const s = status(c.id);
        el.classList.toggle("learning", s === "learning");
        el.classList.toggle("known", s === "known");
        el.querySelector(".case-badge")!.textContent = LABEL[s];
        el.querySelector(".case-alg")!.textContent = mainAlg(c, algs);
        el.hidden = !shown(s);
      }
      // Groupe sans cas visible masqué ; message si plus rien dans le bloc.
      for (const g of block.body.children) {
        (g as HTMLElement).hidden = [...g.querySelectorAll<HTMLElement>(".case-card")].every((el) => el.hidden);
      }
      block.empty.hidden = block.cases.some((c) => shown(status(c.id)));
      const n = (s: CaseStatus) => block.cases.filter((c) => status(c.id) === s).length;
      block.count.textContent = ` · ${n("known")} maîtrisés, ${n("learning")} à travailler`;
    }
    const all = blocks.flatMap((b) => b.cases);
    allBtn.classList.toggle("selected", active.size === 0);
    for (const { f, btn, n } of filterBtns) {
      btn.classList.toggle("selected", active.has(f));
      n.textContent = `(${all.filter((c) => status(c.id) === f).length})`;
    }
  }

  container.append(
    h("div", { class: "algos-head" }, h("h1", {}, "Algos"), h("a", { href: algoHref("notation"), class: "back" }, "Notation ›")),
    h(
      "p",
      { class: "muted small" },
      "Dernière couche en haut (jaune), face verte devant. Les flèches montrent où va chaque pièce. Touche un cas pour choisir ton algo et son état.",
    ),
    h("div", { class: "case-filters" }, ...setBtns),
    h("div", { class: "case-filters" }, allBtn, ...filterBtns.map((b) => b.btn)),
    soon,
    ...blocks.map((b) => b.el),
  );
  build();
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
      caseSvg(caseView(c.alg), caseKind(c), 140),
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
