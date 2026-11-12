// Onglet Entraînement : pour l'instant l'échauffement (triggers + PLL connues).
// Cube connecté : les répétitions sont comptées toutes seules (état du cube) et on
// passe à l'exercice suivant automatiquement. Sans cube : chrono à la main
// (« Démarrer » / « Terminé »).

import type { View } from "../../app/router";
import { cubeFacelets, cubeStatus, onCubeEvent } from "../../ble/cube-service";
import { mainAlg } from "../../cube/case-algs";
import { PLL_CASES } from "../../cube/cases";
import type { TrainingItem } from "../../storage/db";
import { getSetting } from "../../storage/settings";
import { addTrainingSession } from "../../storage/training";
import { formatTime } from "../../timer/format";
import { WarmupTracker, cubeMoves, drawWarmup, moveProgress, moveWeights, type PllChoice, type WarmupExercise } from "../../training/warmup";
import { algView } from "../alg-view";
import { h } from "../dom";

/** Vitesse en quarts de tour par seconde. */
const tps = (moves: number, ms: number) => (ms > 0 ? (moves / (ms / 1000)).toFixed(1) : "—");

async function pllChoices(): Promise<PllChoice[]> {
  const [statuses, algs] = await Promise.all([getSetting("caseStatus"), getSetting("caseAlgs")]);
  return PLL_CASES.flatMap((c) => {
    const status = statuses[c.id];
    return status === "known" || status === "learning" ? [{ id: c.id, status, alg: mainAlg(c, algs) }] : [];
  });
}

export const trainingView: View = {
  title: "Entraînement",
  mount(container) {
    let cleanupSession: (() => void) | null = null;

    function home(): void {
      cleanupSession?.();
      cleanupSession = null;
      const info = h("p", { class: "muted small" }, "…");
      const start = h("button", { onclick: () => void begin() }, "Commencer l'échauffement");
      container.replaceChildren(
        h("h1", {}, "Entraînement"),
        h(
          "section",
          { class: "card" },
          h("h2", {}, "Échauffement"),
          h(
            "p",
            {},
            "3 triggers, puis 5 PLL tirées au hasard parmi tes PLL maîtrisées (complétées par celles à travailler). Chaque exercice est répété jusqu'à ce que le cube revienne à son point de départ.",
          ),
          h(
            "p",
            { class: "muted small" },
            "Cube connecté : les répétitions sont comptées toutes seules. Sans cube : touche « Démarrer » puis « Terminé » pour chaque exercice. Tiens le cube jaune en haut, vert devant.",
          ),
          info,
          start,
        ),
      );
      void pllChoices().then((plls) => {
        const known = plls.filter((p) => p.status === "known").length;
        const learning = plls.length - known;
        info.textContent =
          plls.length === 0
            ? "Aucune PLL marquée maîtrisée ou à travailler (onglet Algos) : l'échauffement se fera avec les triggers seuls."
            : `PLL disponibles : ${known} maîtrisée${known > 1 ? "s" : ""}, ${learning} à travailler.`;
      });
    }

    async function begin(): Promise<void> {
      const exercises = drawWarmup(await pllChoices());
      cleanupSession = runSession(container, exercises, home);
    }

    home();
    return () => cleanupSession?.();
  },
};

/** Déroule une séance ; renvoie la fonction de nettoyage. */
function runSession(container: HTMLElement, exercises: WarmupExercise[], onQuit: () => void): () => void {
  const results: TrainingItem[] = [];
  let index = 0;
  let tracker: WarmupTracker | null = null;
  let manualStart: number | null = null;
  let ticker = 0;
  let nextTimer = 0;
  let saved = false;

  const isConnected = () => cubeStatus.get().state === "connected" && cubeFacelets.get() !== null;

  const progress = h("p", { class: "muted small" });
  const title = h("h2", {});
  const formula = h("div", { class: "warmup-alg" });
  const reps = h("p", { class: "warmup-reps" });
  const fix = h("p", { class: "corrections" });
  let moveEls: HTMLElement[] = [];
  let weights: number[] = [];
  const clock = h("p", { class: "big-time warmup-clock" });
  const note = h("p", { class: "muted small" });
  const mainBtn = h("button", {});
  const restartBtn = h("button", { class: "secondary", onclick: () => startExercise() }, "Recommencer l'exercice");
  const skipBtn = h("button", { class: "secondary", onclick: () => finish(true) }, "Passer");
  const quitBtn = h("button", { class: "link", onclick: () => endSession() }, "Arrêter la séance");

  function startExercise(): void {
    const ex = exercises[index];
    clearInterval(ticker);
    tracker = isConnected() ? new WarmupTracker(ex, cubeFacelets.get()!) : null;
    manualStart = null;
    progress.textContent = `Exercice ${index + 1} / ${exercises.length} · ${ex.kind === "trigger" ? "trigger" : "PLL"}`;
    title.textContent = ex.label;
    const view = algView(ex.alg, { interactive: true });
    formula.replaceChildren(view, h("span", { class: "warmup-times" }, ` ×${ex.reps}`));
    moveEls = [...view.querySelectorAll<HTMLElement>(".mv")];
    weights = moveWeights(ex.alg);
    clock.textContent = formatTime(0);
    ticker = window.setInterval(tick, 100);
    render();
  }

  function elapsed(now = performance.now()): number {
    if (tracker) return tracker.firstMoveAt === null ? 0 : (tracker.finishedAt ?? now) - tracker.firstMoveAt;
    return manualStart === null ? 0 : now - manualStart;
  }

  function tick(): void {
    clock.textContent = formatTime(elapsed());
  }

  function render(): void {
    const ex = exercises[index];
    if (tracker) {
      reps.replaceChildren(
        ...Array.from({ length: ex.reps }, (_, k) => h("span", { class: k < tracker!.done ? "rep done" : "rep" })),
        h("span", { class: "muted small" }, ` ${tracker.done} / ${ex.reps}`),
      );
      note.textContent = tracker.extraMoves
        ? `Mouvements en trop : ${tracker.extraMoves}`
        : "Suivi en direct : tiens le cube comme tu veux, les répétitions se comptent toutes seules.";
      // Formule allumée au fil des mouvements, et ce qu'il faut défaire en cas d'écart.
      moveProgress(weights, tracker.posInRep).forEach((st, i) => moveEls[i]?.setAttribute("data-progress", st));
      const fixes = tracker.lost ? tracker.corrections() : [];
      fix.hidden = !tracker.lost;
      fix.textContent = fixes === null ? "⚠ Trop d'écarts : touche « Recommencer l'exercice »." : `⚠ Défais : ${fixes.join(" ")}`;
      mainBtn.hidden = true;
      restartBtn.hidden = false;
    } else {
      reps.replaceChildren(h("span", { class: "muted small" }, `${ex.reps} répétitions`));
      fix.hidden = true;
      moveEls.forEach((el) => el.removeAttribute("data-progress"));
      note.textContent = isConnected() ? "Cube connecté : il sera suivi à partir de l'exercice suivant." : "Sans cube : chrono à la main.";
      mainBtn.hidden = false;
      restartBtn.hidden = true;
      mainBtn.textContent = manualStart === null ? "Démarrer" : "Terminé";
      mainBtn.onclick = () => {
        if (manualStart === null) {
          manualStart = performance.now();
          render();
        } else finish(false);
      };
    }
  }

  function finish(skipped: boolean): void {
    const ex = exercises[index];
    clearInterval(ticker);
    results.push({
      label: ex.label,
      alg: ex.alg,
      reps: ex.reps,
      timeMs: Math.round(elapsed()),
      connected: tracker !== null,
      expectedMoves: tracker?.expectedMoves ?? cubeMoves(ex).length,
      ...(tracker ? { moves: tracker.moves } : {}),
      ...(skipped ? { skipped: true } : {}),
    });
    tracker = null;
    index++;
    if (index < exercises.length) startExercise();
    else endSession();
  }

  async function endSession(): Promise<void> {
    clearInterval(ticker);
    clearTimeout(nextTimer);
    tracker = null;
    const done = results.filter((r) => !r.skipped);
    if (done.length && !saved) {
      saved = true;
      await addTrainingSession({ date: Date.now(), kind: "warmup", items: results });
    }
    showSummary();
  }

  function showSummary(): void {
    const done = results.filter((r) => !r.skipped && r.timeMs > 0);
    const speed = (r: TrainingItem) => r.expectedMoves / (r.timeMs / 1000);
    const slowest = done.length > 1 ? done.reduce((a, b) => (speed(b) < speed(a) ? b : a)) : null;
    container.replaceChildren(
      h("h1", {}, "Échauffement terminé"),
      h(
        "section",
        { class: "card" },
        results.length === 0
          ? h("p", { class: "muted" }, "Aucun exercice fait.")
          : h(
              "table",
              { class: "warmup-table" },
              h("tr", {}, h("th", {}, "Exercice"), h("th", {}, "Temps"), h("th", {}, "Tours/s"), h("th", {}, "Erreurs")),
              ...results.map((r) =>
                h(
                  "tr",
                  { class: r === slowest ? "slowest" : "" },
                  h("td", {}, r.label, r === slowest ? h("small", { class: "muted" }, " · le plus lent") : null),
                  h("td", {}, r.skipped ? "passé" : formatTime(r.timeMs)),
                  h("td", {}, r.skipped ? "—" : tps(r.expectedMoves, r.timeMs)),
                  h("td", {}, r.moves === undefined ? "—" : String(Math.max(0, r.moves - r.expectedMoves))),
                ),
              ),
            ),
        h("p", { class: "muted small" }, "Tours/s = quarts de tour attendus par seconde. Erreurs = mouvements en trop (cube connecté)."),
      ),
      h("div", { class: "row" }, h("button", { onclick: () => onQuit() }, "Retour")),
    );
  }

  const unsubscribeMoves = onCubeEvent((event) => {
    if (event.type !== "move" || !tracker || tracker.finished) return;
    tracker.move(event.move, cubeFacelets.get()!, performance.now());
    render();
    if (tracker.finished) {
      clearInterval(ticker);
      tick();
      nextTimer = window.setTimeout(() => finish(false), 700);
    }
  });
  const unsubscribeStatus = cubeStatus.subscribe(() => {
    if (index < exercises.length && container.contains(title)) render();
  });

  container.replaceChildren(
    h(
      "section",
      { class: "card warmup" },
      progress,
      title,
      formula,
      reps,
      fix,
      clock,
      note,
      h("div", { class: "row" }, mainBtn, restartBtn, skipBtn),
      quitBtn,
    ),
  );
  if (exercises.length) startExercise();
  else void endSession();

  return () => {
    clearInterval(ticker);
    clearTimeout(nextTimer);
    unsubscribeMoves();
    unsubscribeStatus();
  };
}
