// Écran Chrono. Deux modes :
// - manuel : maintien/relâche sur l'écran (ou barre espace), TimerMachine ;
// - cube : dès qu'un cube connecté a un état connu, SmartSession pilote tout
//   (guidage du mélange, inspection, départ au 1er mouvement, arrêt à la résolution).

import type { View } from "../../app/router";
import { cubeFacelets, onCubeEvent } from "../../ble/cube-service";
import { SmartSession, type SmartResult } from "../../cube/smart-session";
import type { Penalty, Solve } from "../../storage/db";
import { getSetting } from "../../storage/settings";
import { addSolve, deleteSolve, setPenalty, solves } from "../../storage/solves";
import { formatTime } from "../../timer/format";
import { generateScramble } from "../../timer/scramble";
import { averageOf, effectiveTime } from "../../timer/stats";
import { INSPECTION_DNF_MS, INSPECTION_MS, TimerMachine } from "../../timer/timer-machine";
import { h } from "../dom";
import { keepScreenOn } from "../wake-lock";

function vibrate(ms: number): void {
  navigator.vibrate?.(ms);
}

function formatSolve(solve: Solve): string {
  const t = formatTime(effectiveTime(solve));
  return solve.penalty === "+2" ? `${t}+` : t;
}

/** Texte du décompte d'inspection : 15, 14… puis +2, puis DNF. */
function inspectionText(elapsed: number): string {
  if (elapsed > INSPECTION_DNF_MS) return "DNF";
  const left = Math.ceil((INSPECTION_MS - elapsed) / 1000);
  return left > 0 ? String(left) : "+2";
}

/** Pendant le solve on n'affiche que les dixièmes (moins distrayant). */
function runningText(ms: number): string {
  return formatTime(ms).replace(/\d$/, "");
}

export const timerView: View = {
  title: "Chrono",
  mount(container) {
    let inspectionEnabled = true;
    void getSetting("inspectionEnabled").then((v) => (inspectionEnabled = v));

    let scramble = "";
    let lastSolve: Solve | null = null;
    let disposed = false;

    // --- Éléments ---------------------------------------------------------

    const modeBadge = h("span", { class: "mode-badge" });
    const scrambleEl = h("p", { class: "scramble" }, "Génération du mélange…");
    const correctionsEl = h("p", { class: "corrections" });
    const newScrambleBtn = h("button", { class: "link", onclick: () => void nextScramble() }, "Nouveau mélange ↻");
    const display = h("div", { class: "time-display" }, "0.00");
    const hint = h("p", { class: "timer-hint muted" });
    const cancelBtn = h("button", { class: "secondary cancel", onclick: () => cancel() }, "Annuler");
    const ao5El = h("span", {}, "—");
    const ao12El = h("span", {}, "—");
    const countEl = h("span", {}, "0");

    const penaltyBtns = {
      none: h("button", { class: "secondary", onclick: () => void applyPenalty("none") }, "OK"),
      "+2": h("button", { class: "secondary", onclick: () => void applyPenalty("+2") }, "+2"),
      DNF: h("button", { class: "secondary", onclick: () => void applyPenalty("DNF") }, "DNF"),
    } satisfies Record<Penalty, HTMLButtonElement>;
    const deleteBtn = h("button", { class: "secondary danger", onclick: () => void removeLast() }, "Supprimer");
    const lastActions = h("div", { class: "row last-actions" }, penaltyBtns.none, penaltyBtns["+2"], penaltyBtns.DNF, deleteBtn);

    const zone = h("div", { class: "timer-zone" }, display, hint, cancelBtn);

    container.append(
      h("div", { class: "scramble-box" }, modeBadge, scrambleEl, correctionsEl, newScrambleBtn),
      zone,
      h(
        "div",
        { class: "averages" },
        h("div", {}, h("small", { class: "muted" }, "ao5"), ao5El),
        h("div", {}, h("small", { class: "muted" }, "ao12"), ao12El),
        h("div", {}, h("small", { class: "muted" }, "solves"), countEl),
      ),
      lastActions,
    );

    // --- Logique ----------------------------------------------------------

    const manual = new TimerMachine({
      inspection: () => inspectionEnabled,
      onFinish: (result) =>
        void saveSolve({ date: Date.now(), timeMs: result.timeMs, penalty: result.penalty, scramble, source: "manual" }),
    });

    const smart = new SmartSession({
      inspection: () => inspectionEnabled,
      onFinish: (result) => void saveSmartResult(result),
    });

    const isSmart = () => cubeFacelets.get() != null;

    async function nextScramble(): Promise<void> {
      if (manual.state.name !== "idle" || smart.state.name === "running") return;
      const s = await generateScramble();
      if (disposed) return;
      scramble = s;
      smart.setScramble(scramble, cubeFacelets.get());
      render();
    }

    async function saveSolve(solve: Omit<Solve, "id">): Promise<void> {
      vibrate(40);
      lastSolve = await addSolve(solve);
      render();
      await nextScramble();
    }

    async function saveSmartResult(result: SmartResult): Promise<void> {
      const t0 = result.moves[0];
      const useCubeClock = t0.cubeTimestamp != null && result.moves.every((m) => m.cubeTimestamp != null);
      await saveSolve({
        date: Date.now(),
        timeMs: result.timeMs,
        penalty: result.penalty,
        scramble: result.scramble,
        source: "cube",
        moves: result.moves.map((m) => ({
          m: m.move,
          t: useCubeClock ? m.cubeTimestamp! - t0.cubeTimestamp! : m.timestamp - t0.timestamp,
        })),
      });
    }

    function cancel(): void {
      manual.cancel();
      smart.restart(cubeFacelets.get());
      render();
    }

    async function applyPenalty(penalty: Penalty): Promise<void> {
      if (lastSolve?.id == null) return;
      await setPenalty(lastSolve.id, penalty);
      lastSolve = { ...lastSolve, penalty };
      render();
    }

    async function removeLast(): Promise<void> {
      if (lastSolve?.id == null) return;
      await deleteSolve(lastSolve.id);
      lastSolve = null;
      render();
    }

    // --- Affichage --------------------------------------------------------

    const idleText = () => (lastSolve ? formatSolve(lastSolve) : "0.00");

    let scrambleKey = "";

    function renderScrambleSmart(): void {
      const s = smart.state;
      if (s.name === "scrambling") {
        const view = s.tracker.view();
        const key = JSON.stringify(view);
        if (key === scrambleKey) return;
        scrambleKey = key;
        scrambleEl.classList.remove("dim");
        scrambleEl.replaceChildren(
          ...view.steps.flatMap((step, i) => [i > 0 ? " " : "", h("span", { class: `step ${step.state}` }, step.text)]),
        );
        correctionsEl.textContent = view.corrections.length ? `⚠ Corrige d'abord : ${view.corrections.join(" ")}` : "";
      } else {
        const key = `${s.name}|${scramble}`;
        if (key === scrambleKey) return;
        scrambleKey = key;
        scrambleEl.textContent = scramble || "Génération du mélange…";
        scrambleEl.classList.toggle("dim", s.name !== "needSolve");
        correctionsEl.textContent = "";
      }
    }

    /** Renvoie l'état utilisé pour les couleurs/plein écran. */
    function renderSmart(now: number): string {
      const s = smart.state;
      renderScrambleSmart();
      switch (s.name) {
        case "needSolve":
          display.textContent = idleText();
          hint.textContent = "Résous le cube pour commencer";
          return "idle";
        case "scrambling":
          display.textContent = idleText();
          hint.textContent = "Applique le mélange sur le cube";
          return "idle";
        case "wrongState":
          display.textContent = idleText();
          hint.textContent = "Le cube ne correspond pas au mélange : résous-le pour recommencer";
          return "idle";
        case "inspecting":
          display.textContent = inspectionText(now - s.startedAt);
          hint.textContent = "Inspection — le chrono part au premier mouvement";
          return "inspecting";
        case "waiting":
          display.textContent = "0.00";
          hint.textContent = "Prêt — le chrono part au premier mouvement";
          return "ready";
        case "running":
          display.textContent = runningText(smart.elapsed(now) ?? 0);
          hint.textContent = "";
          return "running";
      }
    }

    function renderManual(now: number): string {
      const s = manual.state;
      const key = `manual|${scramble}`;
      if (key !== scrambleKey) {
        scrambleKey = key;
        scrambleEl.classList.remove("dim");
        scrambleEl.textContent = scramble || "Génération du mélange…";
        correctionsEl.textContent = "";
      }
      switch (s.name) {
        case "idle":
          display.textContent = idleText();
          hint.textContent = inspectionEnabled ? "Touche pour lancer l'inspection" : "Maintiens puis relâche pour démarrer";
          break;
        case "inspecting":
          display.textContent = inspectionText(now - s.startedAt);
          hint.textContent = "Maintiens puis relâche pour démarrer";
          break;
        case "holding":
          display.textContent = s.inspectionStartedAt != null ? inspectionText(now - s.inspectionStartedAt) : "0.00";
          hint.textContent = "Maintiens…";
          break;
        case "ready":
          hint.textContent = "Relâche !";
          break;
        case "running":
          display.textContent = runningText(now - s.startedAt);
          hint.textContent = "";
          break;
      }
      return s.name;
    }

    let wasSmart: boolean | null = null;

    function render(): void {
      const now = performance.now();
      const smartMode = isSmart();
      if (smartMode !== wasSmart) {
        // Changement de mode : on repart proprement.
        manual.cancel();
        smart.restart(cubeFacelets.get());
        scrambleKey = "";
        wasSmart = smartMode;
      }

      modeBadge.textContent = smartMode ? "🔗 Cube connecté" : "✋ Manuel";
      modeBadge.classList.toggle("on", smartMode);
      const state = smartMode ? renderSmart(now) : renderManual(now);

      zone.dataset.state = state;
      // Plein écran pendant inspection et solve (et pendant le maintien en manuel).
      const timing = smartMode ? state === "inspecting" || state === "running" : state !== "idle";
      document.body.classList.toggle("timing", timing);
      cancelBtn.hidden = !(smartMode && timing);
      newScrambleBtn.hidden = timing || smart.state.name === "running";

      lastActions.hidden = timing || !lastSolve;
      if (lastSolve) {
        for (const [p, btn] of Object.entries(penaltyBtns)) btn.classList.toggle("selected", p === lastSolve.penalty);
      }
    }

    // --- Abonnements ------------------------------------------------------

    const unsubSolves = solves.subscribe((list) => {
      ao5El.textContent = formatTime(averageOf(list, 5));
      ao12El.textContent = formatTime(averageOf(list, 12));
      countEl.textContent = String(list.length);
      if (lastSolve && !list.some((x) => x.id === lastSolve?.id)) lastSolve = null;
    });

    const unsubCube = onCubeEvent((e) => {
      const facelets = cubeFacelets.get();
      if (!facelets) return;
      if (e.type === "move") {
        smart.onMove({ move: e.move, timestamp: e.timestamp, cubeTimestamp: e.cubeTimestamp }, facelets);
      } else if (e.type === "facelets") {
        smart.onSync(facelets);
      }
      render();
    });

    let raf = 0;
    const loop = () => {
      if (!isSmart()) manual.tick(performance.now());
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // --- Entrées manuelles : toucher sur la zone, ou barre espace ---------
    // (ignorées en mode cube, sauf Échap pour annuler)

    const onPointerDown = (e: PointerEvent) => {
      if (isSmart() || e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      manual.press(performance.now());
      render();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (isSmart()) return;
      e.preventDefault();
      manual.release(performance.now());
      render();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        cancel();
        return;
      }
      if (isSmart()) return;
      if (manual.state.name === "running") {
        e.preventDefault();
        manual.press(performance.now());
        return;
      }
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      manual.press(performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (isSmart() || e.code !== "Space") return;
      e.preventDefault();
      manual.release(performance.now());
    };

    zone.addEventListener("pointerdown", onPointerDown);
    zone.addEventListener("pointerup", onPointerUp);
    zone.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const releaseWakeLock = keepScreenOn();

    void nextScramble();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      unsubSolves();
      unsubCube();
      releaseWakeLock();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.body.classList.remove("timing");
    };
  },
};
