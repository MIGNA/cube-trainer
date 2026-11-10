import type { View } from "../../app/router";
import type { Solve } from "../../storage/db";
import { solves } from "../../storage/solves";
import { formatTime } from "../../timer/format";
import { averageOf, bestAverage, bestSingle, effectiveTime, meanOf, rollingAverages } from "../../timer/stats";
import { h } from "../dom";

/** Nombre de solves affichés dans l'historique avant « Afficher plus ». */
const PAGE = 100;

function formatSolve(solve: Solve): string {
  const t = formatTime(effectiveTime(solve));
  return solve.penalty === "+2" ? `${t}+` : t;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function stat(label: string, current: number | null, best: number | null): HTMLElement {
  return h(
    "div",
    { class: "stat" },
    h("small", { class: "muted" }, label),
    h("strong", {}, formatTime(current)),
    h("small", { class: "muted" }, `meilleur ${formatTime(best)}`),
  );
}

export const statsView: View = {
  title: "Statistiques",
  mount(container) {
    let shown = PAGE;

    const summary = h("section", { class: "card stats-grid" });
    const list = h("ul", { class: "solve-list" });
    const more = h("button", { class: "secondary", onclick: () => { shown += PAGE; render(solves.get()); } }, "Afficher plus");
    const empty = h("p", { class: "muted" }, "Aucun solve pour l'instant. Lance le chrono !");

    container.append(h("h1", {}, "Statistiques"), summary, h("section", { class: "card" }, h("h2", {}, "Historique"), empty, list, more));

    function render(all: readonly Solve[]): void {
      summary.replaceChildren(
        stat("Single", all.length ? effectiveTime(all[all.length - 1]) : null, bestSingle(all)),
        stat("ao5", averageOf(all, 5), bestAverage(all, 5)),
        stat("ao12", averageOf(all, 12), bestAverage(all, 12)),
        h(
          "div",
          { class: "stat" },
          h("small", { class: "muted" }, "Solves"),
          h("strong", {}, String(all.length)),
          h("small", { class: "muted" }, `moyenne ${formatTime(meanOf(all.filter((s) => s.penalty !== "DNF")))}`),
        ),
      );

      const ao5 = rollingAverages(all, 5);
      const ao12 = rollingAverages(all, 12);
      const rows: HTMLElement[] = [];
      for (let i = all.length - 1; i >= Math.max(0, all.length - shown); i--) {
        const solve = all[i];
        const row = h(
          "li",
          { class: "solve-row", onclick: () => { location.hash = `#/solve/${solve.id}`; } },
          h("span", { class: "muted solve-index" }, String(i + 1)),
          h("span", { class: "solve-time" }, formatSolve(solve)),
          h("span", { class: "muted" }, `ao5 ${formatTime(ao5[i])}`),
          h("span", { class: "muted" }, `ao12 ${formatTime(ao12[i])}`),
          h("span", { class: "muted solve-date" }, formatDate(solve.date), solve.moves?.length ? " · 🧊 analyse" : ""),
        );
        rows.push(row);
      }
      list.replaceChildren(...rows);
      empty.hidden = all.length > 0;
      more.hidden = all.length <= shown;
    }

    return solves.subscribe(render);
  },
};
