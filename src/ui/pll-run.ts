// Exercice « Toutes mes PLL » : grille des PLL choisies, cochées au fur et à mesure.
// Cube connecté : chaque PLL est reconnue toute seule (training/pll-run.ts) et les
// mouvements en trop sont comptés. Sans cube : on touche la case de la PLL faite.

import { cubeFacelets, cubeStatus, onCubeEvent } from "../ble/cube-service";
import { caseView } from "../cube/case-diagram";
import { PLL_CASES } from "../cube/cases";
import type { TrainingItem } from "../storage/db";
import { addTrainingSession } from "../storage/training";
import { PllRunTracker, pllStats, type PllDone } from "../training/pll-run";
import type { PllChoice } from "../training/warmup";
import { caseSvg } from "./case-svg";
import { h } from "./dom";
import { onHelperSolved } from "./solve-sheet";

const pllName = (id: string) => `${id}-perm`;

/** Déroule l'exercice ; renvoie la fonction de nettoyage. */
export function runPllRun(container: HTMLElement, choices: PllChoice[], onQuit: () => void): () => void {
  const connected = cubeStatus.get().state === "connected" && cubeFacelets.get() !== null;
  const algs = Object.fromEntries(choices.map((c) => [c.id, c.alg]));
  const tracker = connected ? new PllRunTracker(algs, cubeFacelets.get()!) : null;
  const manual: PllDone[] = [];
  const done = () => tracker?.done ?? manual;
  const order = PLL_CASES.filter((c) => choices.some((p) => p.id === c.id));

  const counter = h("p", { class: "pll-run-count" });
  const last = h("p", { class: "muted small pll-run-last" });
  const tiles = new Map<string, HTMLElement>();
  const grid = h(
    "div",
    { class: "pll-run-grid" },
    ...order.map((c) => {
      // Compteur à côté du nom : passages sans erreur (vert), avec erreurs (rouge).
      const badge = h("span", { class: "pll-run-badge" });
      const tile = h(
        connected ? "div" : "button",
        {
          class: "pll-run-tile",
          onclick: connected
            ? null
            : () => {
                manual.push({ id: c.id, moves: 0, extra: 0 });
                update(c.id);
              },
        },
        caseSvg(caseView(c.alg), "pll", 56),
        h("span", { class: "pll-run-name" }, h("strong", {}, c.id), badge),
      );
      tiles.set(c.id, tile);
      return tile;
    }),
  );
  const undoBtn = h(
    "button",
    {
      class: "secondary",
      onclick: () => {
        manual.pop();
        update(null);
      },
    },
    "Annuler la dernière",
  );
  const restartBtn = h(
    "button",
    {
      class: "secondary",
      onclick: () => {
        const state = cubeFacelets.get();
        if (tracker && state) tracker.restart(state);
        last.textContent = "Nouveau départ : l'état actuel du cube. La tentative en cours est oubliée.";
      },
    },
    "Repartir d'ici",
  );
  const endBtn = h("button", { onclick: () => void end() }, "Terminer");

  function update(justDone: string | null): void {
    const list = done();
    const counts = new Map<string, number>();
    const errors = new Map<string, number>();
    for (const d of list) {
      counts.set(d.id, (counts.get(d.id) ?? 0) + 1);
      if (d.extra > 0) errors.set(d.id, (errors.get(d.id) ?? 0) + 1);
    }
    const remaining = order.filter((c) => !counts.has(c.id));
    for (const [id, tile] of tiles) {
      const n = counts.get(id) ?? 0;
      tile.classList.toggle("done", n > 0);
      tile.classList.toggle("just", id === justDone);
      const bad = errors.get(id) ?? 0;
      tile.querySelector(".pll-run-badge")!.replaceChildren(
        ...(n - bad > 0 ? [h("span", { class: "ok", title: "sans erreur" }, String(n - bad))] : []),
        ...(bad > 0 ? [h("span", { class: "ko", title: "avec erreurs" }, String(bad))] : []),
      );
    }
    counter.textContent =
      remaining.length === 0
        ? `Toutes faites (${order.length}) ! Continue autant que tu veux, ou termine.`
        : `${order.length - remaining.length} / ${order.length} faites · reste : ${remaining.map((c) => c.id).join(", ")}`;
    const lastDone = list.at(-1);
    if (justDone && lastDone) {
      const known = order.some((c) => c.id === lastDone.id) ? "" : " (pas dans ta liste)";
      last.textContent = tracker
        ? `${pllName(lastDone.id)}${known} · ${lastDone.extra ? `${lastDone.extra} mouvement${lastDone.extra > 1 ? "s" : ""} en trop` : "sans erreur"}`
        : `${pllName(lastDone.id)} cochée.`;
    } else if (!justDone) last.textContent = "";
    undoBtn.hidden = tracker !== null || manual.length === 0;
  }

  let saved = false;
  async function end(): Promise<void> {
    unsubscribe();
    offSolved();
    const list = done();
    const stats = pllStats(list);
    if (list.length && !saved) {
      saved = true;
      const items: TrainingItem[] = stats.map((s) => ({
        label: s.id,
        alg: algs[s.id] ?? PLL_CASES.find((c) => c.id === s.id)!.alg,
        reps: s.count,
        timeMs: 0,
        connected: tracker !== null,
        expectedMoves: s.moves - s.extra,
        ...(tracker ? { moves: s.moves } : {}),
      }));
      await addTrainingSession({ date: Date.now(), kind: "pll-run", items });
    }
    const missing = order.filter((c) => !stats.some((s) => s.id === c.id));
    container.replaceChildren(
      h("h1", {}, "Toutes mes PLL : bilan"),
      h(
        "section",
        { class: "card" },
        stats.length === 0
          ? h("p", { class: "muted" }, "Aucune PLL faite.")
          : h(
              "table",
              { class: "warmup-table" },
              tracker
                ? h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Sans erreur"), h("th", {}, "Avec erreurs"))
                : h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Fois")),
              ...stats.map((s) =>
                h(
                  "tr",
                  { class: tracker && s.withErrors > 0 ? "slowest" : "" },
                  h("td", {}, pllName(s.id)),
                  ...(tracker ? [h("td", {}, String(s.clean)), h("td", {}, String(s.withErrors))] : [h("td", {}, String(s.count))]),
                ),
              ),
            ),
        missing.length ? h("p", { class: "muted small" }, `Pas faites : ${missing.map((c) => c.id).join(", ")}.`) : null,
        tracker
          ? h(
              "p",
              { class: "muted small" },
              "Avec erreurs = au moins un mouvement en trop par rapport à ta formule (onglet Algos ; les AUF ne comptent pas), ou une tentative ratée puis défaite. Les PLL les plus souvent ratées sont en haut.",
            )
          : null,
      ),
      h("div", { class: "row" }, h("button", { onclick: () => onQuit() }, "Retour")),
    );
  }

  const unsubscribe = onCubeEvent((event) => {
    if (!tracker || (event.type !== "move" && event.type !== "facelets")) return;
    const e = event.type === "move" ? tracker.move(cubeFacelets.get()!) : tracker.observe(cubeFacelets.get()!);
    if (import.meta.env.DEV) {
      const what = event.type === "move" ? event.move : "état du cube";
      const info = e ? ` → ${e.kind === "pll" ? `${e.done.id} (${e.done.extra} en trop)` : "retour à l'état d'avant"}` : "";
      console.log(`[toutes les PLL] ${what} · ${tracker.since} depuis la dernière PLL${info}`);
    }
    if (e?.kind === "pll") update(e.done.id);
    else if (e?.kind === "back") last.textContent = "Revenu à l'état d'avant : vas-y, la PLL sera reconnue.";
  });

  // Cube résolu avec le bouton « Résoudre » : on repart de là.
  const offSolved = onHelperSolved(() => {
    const state = cubeFacelets.get();
    if (!tracker || !state) return;
    tracker.restart(state);
    last.textContent = "Cube résolu : nouveau départ.";
  });

  container.replaceChildren(
    h(
      "section",
      { class: "card pll-run" },
      h("h2", {}, "Toutes mes PLL"),
      h(
        "p",
        { class: "muted small" },
        tracker
          ? "Enchaîne tes PLL dans l'ordre que tu veux : chacune est cochée dès que sa formule est faite (reconnue par son effet sur le cube : AUF libres, tiens le cube comme tu veux). Erreur ? Reviens à l'état d'avant la PLL et recommence."
          : "Sans cube : touche la case de chaque PLL que tu viens de faire.",
      ),
      counter,
      last,
      grid,
      h("div", { class: "row" }, tracker ? restartBtn : undoBtn, endBtn),
    ),
  );
  update(null);

  return () => {
    unsubscribe();
    offSolved();
  };
}
