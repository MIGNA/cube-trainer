// Carte « Mes séances » de l'onglet Entraînement : séances passées, la plus récente en haut ;
// chacune se déplie pour revoir son bilan.

import type { TrainingSession } from "../storage/db";
import { allTrainingSessions } from "../storage/training";
import { formatTime } from "../timer/format";
import { pllStats } from "../training/pll-run";
import { h } from "./dom";
import { sec } from "./solve-summary";

const DATE = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const SHOWN = 15;
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;
const tps = (moves: number, ms: number) => (ms > 0 ? (moves / (ms / 1000)).toFixed(1) : "—");

function summaryOf(s: TrainingSession): string {
  if (s.kind === "warmup") {
    const done = s.items.filter((i) => !i.skipped);
    const bad = done.filter((i) => i.moves !== undefined && i.moves > i.expectedMoves).length;
    return `Échauffement · ${plural(done.length, "exercice")}${bad ? `, ${bad} avec erreurs` : ""}`;
  }
  const count = s.passes ? s.passes.length : s.items.reduce((n, i) => n + i.reps, 0);
  const bad = s.passes?.filter((p) => p.extra > 0).length ?? 0;
  return `Toutes mes PLL · ${plural(count, "PLL")}${bad ? `, ${bad} avec erreurs` : ""}`;
}

function detailOf(s: TrainingSession): HTMLElement {
  if (s.kind === "warmup") {
    return h(
      "table",
      { class: "warmup-table" },
      h("tr", {}, h("th", {}, "Exercice"), h("th", {}, "Temps"), h("th", {}, "Tours/s"), h("th", {}, "Erreurs")),
      ...s.items.map((r) =>
        h(
          "tr",
          {},
          h("td", {}, r.label),
          h("td", {}, r.skipped ? "passé" : formatTime(r.timeMs)),
          h("td", {}, r.skipped ? "—" : tps(r.expectedMoves, r.timeMs)),
          h("td", {}, r.moves === undefined ? "—" : String(Math.max(0, r.moves - r.expectedMoves))),
        ),
      ),
    );
  }
  if (s.passes) {
    return h(
      "table",
      { class: "warmup-table" },
      h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Sans erreur"), h("th", {}, "Avec erreurs"), h("th", {}, "Temps moyen")),
      ...pllStats(s.passes).map((p) =>
        h(
          "tr",
          { class: p.withErrors > 0 ? "slowest" : "" },
          h("td", {}, `${p.id}-perm`),
          h("td", {}, String(p.clean)),
          h("td", {}, String(p.withErrors)),
          h("td", {}, p.cleanTimeMs === null ? "–" : sec(p.cleanTimeMs)),
        ),
      ),
    );
  }
  // Séance sans détail par passage (cochée à la main, ou plus ancienne).
  return h(
    "table",
    { class: "warmup-table" },
    h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Fois")),
    ...s.items.map((i) => h("tr", {}, h("td", {}, `${i.label}-perm`), h("td", {}, String(i.reps)))),
  );
}

export function trainingHistoryCard(): HTMLElement {
  const body = h("div", {}, h("p", { class: "muted small" }, "Chargement…"));
  const card = h("section", { class: "card" }, h("h2", {}, "Mes séances"), body);
  void allTrainingSessions().then((sessions) => {
    if (sessions.length === 0) {
      body.replaceChildren(h("p", { class: "muted small" }, "Aucune séance pour l'instant."));
      return;
    }
    const recent = [...sessions].reverse().slice(0, SHOWN);
    body.replaceChildren(
      ...recent.map((s) =>
        h(
          "details",
          { class: "session" },
          h("summary", {}, h("span", { class: "muted" }, DATE.format(s.date)), h("br", {}), summaryOf(s)),
          detailOf(s),
        ),
      ),
      ...(sessions.length > SHOWN ? [h("p", { class: "muted small" }, `Les ${SHOWN} dernières sur ${sessions.length}.`)] : []),
      h("p", { class: "muted small" }, "Les temps par PLL, toutes séances et solves confondus, sont dans la fiche de chaque cas (onglet Algos)."),
    );
  });
  return card;
}
