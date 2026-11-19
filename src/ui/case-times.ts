// Carte « Mes temps » de la fiche d'un cas (onglet Algos) : temps d'exécution par situation
// (solves, échauffement, Toutes mes PLL) et derniers passages. Calcul dans training/alg-history.ts.

import { analyzeSolve, type SolveAnalysis } from "../cube/cfop";
import { solves } from "../storage/solves";
import { allTrainingSessions } from "../storage/training";
import { SOURCE_LABELS, RECENT, caseStats, passesFromSession, passesFromSolve, type AlgPass } from "../training/alg-history";
import { h } from "./dom";
import { sec } from "./solve-summary";

/** Analyses déjà faites, par solve (le rejeu d'un solve coûte un peu : une fois suffit). */
const analyses = new Map<number, SolveAnalysis | null>();

function solvePasses(): AlgPass[] {
  return solves.get().flatMap((s) => {
    if (!s.moves?.length || s.id === undefined || s.penalty === "DNF") return [];
    if (!analyses.has(s.id)) analyses.set(s.id, analyzeSolve(s.scramble, s.moves));
    const a = analyses.get(s.id);
    return a ? passesFromSolve(s, a) : [];
  });
}

const fmt = (ms: number | null) => (ms === null ? "–" : sec(ms));
const DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const LAST = 10;

export function caseTimesCard(caseId: string): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted small" }, "Chargement…"));
  const card = h("section", { class: "card case-times" }, h("h2", {}, "Mes temps"), body);

  void allTrainingSessions().then((sessions) => {
    const passes = [...solvePasses(), ...sessions.flatMap(passesFromSession)].filter((p) => p.caseId === caseId);
    if (passes.length === 0) {
      body.replaceChildren(
        h("p", { class: "muted small" }, "Pas encore de passage. Il apparaîtra quand tu feras ce cas en solve avec le cube connecté, ou dans les exercices de l'onglet Entraînement."),
      );
      return;
    }
    const stats = caseStats(passes);
    const table = h(
      "table",
      { class: "warmup-table case-times-table" },
      h("tr", {}, h("th", {}, ""), h("th", {}, `Moyenne`), h("th", {}, "Meilleur"), h("th", {}, "Fois"), h("th", {}, "Erreurs")),
      ...stats.map((s) =>
        h(
          "tr",
          {},
          h("td", {}, SOURCE_LABELS[s.source]),
          h(
            "td",
            {},
            fmt(s.recentMs),
            s.recentRecoMs !== null ? h("small", { class: "tps-exec" }, `reco ${sec(s.recentRecoMs)}`) : null,
          ),
          h("td", {}, fmt(s.bestMs)),
          h("td", {}, String(s.count)),
          h("td", {}, s.errors ? `${s.errors.bad} / ${s.errors.known}` : "–"),
        ),
      ),
    );

    const recent = [...passes].sort((a, b) => b.date - a.date).slice(0, LAST);
    const list = h(
      "ul",
      { class: "case-times-list" },
      ...recent.map((p) => {
        const text = [
          h("span", { class: "muted" }, DATE.format(p.date)),
          ` · ${SOURCE_LABELS[p.source]} · `,
          h("strong", {}, fmt(p.execMs)),
          p.recoMs !== undefined ? h("span", { class: "muted" }, ` (reco ${sec(p.recoMs)})`) : null,
          p.errors ? h("span", { class: "err-mark" }, " · erreurs") : null,
        ];
        return h("li", {}, p.solveId !== undefined ? h("a", { href: `#/solve/${p.solveId}` }, ...text) : h("span", {}, ...text));
      }),
    );

    body.replaceChildren(
      table,
      h(
        "p",
        { class: "muted small" },
        `Temps d'exécution en secondes. Moyenne = ${RECENT} derniers passages sans erreur ; échauffement = temps moyen d'une répétition.`,
      ),
      h("h3", {}, "Derniers passages"),
      list,
    );
  });

  return card;
}
