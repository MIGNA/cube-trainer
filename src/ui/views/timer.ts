import type { View } from "../../app/router";
import type { Penalty, Solve } from "../../storage/db";
import { getSetting } from "../../storage/settings";
import { addSolve, deleteSolve, setPenalty, solves } from "../../storage/solves";
import { formatTime } from "../../timer/format";
import { randomMoveScramble } from "../../timer/scramble";
import { averageOf, effectiveTime } from "../../timer/stats";
import { INSPECTION_DNF_MS, INSPECTION_MS, TimerMachine } from "../../timer/timer-machine";
import { h } from "../dom";
import { keepScreenOn } from "../wake-lock";

function vibrate(ms: number): void {
  navigator.vibrate?.(ms);
}

export const timerView: View = {
  title: "Chrono",
  mount(container) {
    let inspectionEnabled = true;
    void getSetting("inspectionEnabled").then((v) => (inspectionEnabled = v));

    let scramble = randomMoveScramble();
    let lastSolve: Solve | null = null;

    const scrambleEl = h("p", { class: "scramble" }, scramble);
    const newScrambleBtn = h("button", { class: "link", onclick: () => nextScramble() }, "Nouveau mélange ↻");
    const display = h("div", { class: "time-display" }, "0.00");
    const hint = h("p", { class: "timer-hint muted" });
    const ao5El = h("span", {}, "—");
    const ao12El = h("span", {}, "—");
    const countEl = h("span", {}, "0");

    const penaltyBtns = {
      none: h("button", { class: "secondary", onclick: () => applyPenalty("none") }, "OK"),
      "+2": h("button", { class: "secondary", onclick: () => applyPenalty("+2") }, "+2"),
      DNF: h("button", { class: "secondary", onclick: () => applyPenalty("DNF") }, "DNF"),
    } satisfies Record<Penalty, HTMLButtonElement>;
    const deleteBtn = h("button", { class: "secondary danger", onclick: () => void removeLast() }, "Supprimer");
    const lastActions = h("div", { class: "row last-actions" }, penaltyBtns.none, penaltyBtns["+2"], penaltyBtns.DNF, deleteBtn);

    const zone = h("div", { class: "timer-zone" }, display, hint);

    container.append(
      h("div", { class: "scramble-box" }, scrambleEl, newScrambleBtn),
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

    function nextScramble(): void {
      scramble = randomMoveScramble();
      scrambleEl.textContent = scramble;
    }

    const timer = new TimerMachine({
      inspection: () => inspectionEnabled,
      onFinish: async (result) => {
        vibrate(40);
        lastSolve = await addSolve({
          date: Date.now(),
          timeMs: result.timeMs,
          penalty: result.penalty,
          scramble,
          source: "manual",
        });
        nextScramble();
        render();
      },
    });

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

    // --- Affichage -------------------------------------------------------

    function render(): void {
      const now = performance.now();
      const s = timer.state;
      const timing = s.name !== "idle";
      document.body.classList.toggle("timing", timing);
      zone.dataset.state = s.name;

      switch (s.name) {
        case "idle":
          display.textContent = lastSolve ? formatSolve(lastSolve) : "0.00";
          hint.textContent = inspectionEnabled
            ? "Touche pour lancer l'inspection"
            : "Maintiens puis relâche pour démarrer";
          break;
        case "inspecting":
        case "holding": {
          const startedAt = s.name === "inspecting" ? s.startedAt : s.inspectionStartedAt;
          if (startedAt == null) {
            display.textContent = "0.00";
            hint.textContent = "Maintiens…";
          } else {
            const elapsed = now - startedAt;
            const left = Math.ceil((INSPECTION_MS - elapsed) / 1000);
            display.textContent = elapsed > INSPECTION_DNF_MS ? "DNF" : left > 0 ? String(left) : "+2";
            hint.textContent = "Maintiens puis relâche pour démarrer";
          }
          break;
        }
        case "ready":
          hint.textContent = "Relâche !";
          break;
        case "running":
          display.textContent = formatTime(now - s.startedAt).replace(/\d$/, "");
          hint.textContent = "";
          break;
      }

      lastActions.hidden = timing || !lastSolve;
      if (lastSolve) {
        for (const [p, btn] of Object.entries(penaltyBtns)) btn.classList.toggle("selected", p === lastSolve.penalty);
      }
    }

    function formatSolve(solve: Solve): string {
      const t = formatTime(effectiveTime(solve));
      return solve.penalty === "+2" ? `${t}+` : t;
    }

    const unsubSolves = solves.subscribe((list) => {
      ao5El.textContent = formatTime(averageOf(list, 5));
      ao12El.textContent = formatTime(averageOf(list, 12));
      countEl.textContent = String(list.length);
      // Si le dernier solve a été supprimé depuis l'historique
      if (lastSolve && !list.some((x) => x.id === lastSolve?.id)) lastSolve = null;
    });

    let raf = 0;
    const loop = () => {
      timer.tick(performance.now());
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // --- Entrées : toucher sur la zone, ou barre espace sur PC ------------

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      timer.press(performance.now());
      render();
    };
    const onPointerUp = (e: PointerEvent) => {
      e.preventDefault();
      timer.release(performance.now());
      render();
    };
    // Pendant le chrono, la zone couvre tout l'écran (CSS body.timing) :
    // toucher n'importe où l'arrête.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        timer.cancel();
        return;
      }
      if (timer.state.name === "running" && e.code !== "Space") {
        timer.press(performance.now());
        return;
      }
      if (e.code !== "Space" || e.repeat) return;
      e.preventDefault();
      timer.press(performance.now());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      timer.release(performance.now());
    };

    zone.addEventListener("pointerdown", onPointerDown);
    zone.addEventListener("pointerup", onPointerUp);
    zone.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const releaseWakeLock = keepScreenOn();

    return () => {
      cancelAnimationFrame(raf);
      unsubSolves();
      releaseWakeLock();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.body.classList.remove("timing");
    };
  },
};
