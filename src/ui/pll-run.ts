// Exercice « Toutes mes PLL » : grille des PLL choisies, cochées au fur et à mesure.
// Cube connecté : chaque PLL est reconnue toute seule (training/pll-run.ts) et les
// mouvements en trop sont comptés. Sans cube : on touche la case de la PLL faite.

import { cubeFacelets, cubeStatus, onCubeEvent, resyncCube } from "../ble/cube-service";
import { caseView } from "../cube/case-diagram";
import { myAlgs } from "../cube/case-algs";
import { PLL_CASES, checkCaseAlg } from "../cube/cases";
import { getSetting, setSetting } from "../storage/settings";
import { formatTime } from "../timer/format";
import type { TrainingItem } from "../storage/db";
import { addTrainingSession } from "../storage/training";
import { PllRunTracker, groupErrors, pllStats, successRate, type ErrorGroup, type PllDone } from "../training/pll-run";
import type { Holding, PllChoice } from "../training/warmup";
import { caseSvg } from "./case-svg";
import { h } from "./dom";
import type { PllStat } from "../training/pll-run";

/** Case « Réussite » : pourcentage coloré (gris si trop peu de passages). */
function rateCell(s: PllStat): HTMLElement {
  const { rate, tone } = successRate(s);
  return h("td", { class: `rate rate-${tone}` }, `${Math.round(rate * 100)} %`);
}
import { flashName } from "./flash";
import { onHelperSolved } from "./solve-sheet";
import type { SessionControl } from "./views/training";

const pllName = (id: string) => `${id}-perm`;
/** Temps en secondes, virgule française : « 2,14 s ». */
const seconds = (ms: number | null) => (ms === null ? "–" : `${formatTime(ms).replace(".", ",")} s`);

/** Déroule l'exercice dans `container` (mis en pause quand on quitte l'onglet). */
export function runPllRun(
  container: HTMLElement,
  choices: PllChoice[],
  holding: Holding,
  onQuit: () => void,
  onEnded: () => void,
): SessionControl {
  const connected = cubeStatus.get().state === "connected" && cubeFacelets.get() !== null;
  const algs = Object.fromEntries(choices.map((c) => [c.id, c.algs ?? [c.alg]]));
  const tracker = connected ? new PllRunTracker(algs, cubeFacelets.get()!, holding) : null;
  const manual: PllDone[] = [];
  const done = () => tracker?.done ?? manual;
  const order = PLL_CASES.filter((c) => choices.some((p) => p.id === c.id));

  const counter = h("p", { class: "pll-run-count" });
  const last = h("div", { class: "muted small pll-run-last" });
  /** Bandeau « enregistrer cette formule ? » (même formule inconnue faite 2 fois de suite). */
  const proposal = h("div", { class: "pll-run-proposal", hidden: true });
  /** Dernière formule inconnue par PLL et nombre de fois d'affilée. */
  const others = new Map<string, { alg: string; n: number }>();
  /** Formules déjà refusées (on ne les repropose pas pendant la séance). */
  const declined = new Set<string>();

  function noteOther(d: PllDone): void {
    if (!d.other) {
      others.delete(d.id);
      return;
    }
    const prev = others.get(d.id);
    const n = prev?.alg === d.other ? prev.n + 1 : 1;
    others.set(d.id, { alg: d.other, n });
    if (n < 2 || declined.has(`${d.id}|${d.other}`)) return;
    const c = PLL_CASES.find((x) => x.id === d.id)!;
    const check = checkCaseAlg(c, d.other);
    if (!check.ok) return; // aucune tenue où elle résout bien le cas
    const alg = check.alg;
    const close = () => {
      proposal.hidden = true;
      proposal.replaceChildren();
    };
    const save = async (main: boolean) => {
      const saved = await getSetting("caseAlgs");
      const list = myAlgs(c, saved).filter((a) => a !== alg);
      await setSetting("caseAlgs", { ...saved, [c.id]: main ? [alg, ...list] : [...list, alg] });
      tracker?.addAlg(c.id, alg, main);
      others.delete(c.id);
      proposal.replaceChildren(`Enregistrée ${main ? "comme ta formule" : "dans tes algos"} pour ${pllName(c.id)}.`);
      window.setTimeout(close, 3000);
    };
    proposal.hidden = false;
    proposal.replaceChildren(
      h("p", {}, `Tu as fait ${n} fois ${pllName(c.id)} avec cette formule. C'est ta nouvelle formule ?`),
      h("p", {}, h("code", {}, alg)),
      h(
        "div",
        { class: "row" },
        h("button", { onclick: () => void save(true) }, "Ma formule"),
        h("button", { class: "secondary", onclick: () => void save(false) }, "Ajouter à mes algos"),
        h(
          "button",
          {
            class: "secondary",
            onclick: () => {
              declined.add(`${d.id}|${d.other}`);
              close();
            },
          },
          "Non merci",
        ),
      ),
    );
  }
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
      onclick: () => undoLast(),
    },
    connected ? "Annuler la dernière (D4)" : "Annuler la dernière",
  );
  const restartBtn = h(
    "button",
    {
      class: "secondary",
      onclick: () => {
        const state = cubeFacelets.get();
        if (tracker && state) tracker.restart(state);
        rebaseFromCube();
        last.textContent = "Nouveau départ : l'état actuel du cube. La tentative en cours est oubliée.";
      },
    },
    "Repartir d'ici (U4)",
  );
  const endBtn = h("button", { onclick: () => void end() }, connected ? "Terminer (R4)" : "Terminer");

  /** Formule attendue et mouvements faits (pour comprendre une erreur). */
  function detail(d: PllDone): HTMLElement {
    return h(
      "dl",
      { class: "pll-detail" },
      ...(d.other
        ? [h("dt", {}, "Ta formule"), h("dd", {}, h("code", {}, d.expected ?? "")), h("dt", {}, "Fait"), h("dd", {}, h("code", {}, d.other))]
        : [h("dt", {}, "Attendu"), h("dd", {}, h("code", {}, d.expected ?? ""))]),
      ...(d.other ? [] : [h("dt", {}, "Fait")]),
      ...(d.other ? [] : [h(
        "dd",
        {},
        h(
          "code",
          {},
          ...(d.marks
            ? d.marks.flatMap((m, i) => [
                ...(i ? [" "] : []),
                m.kind === "ok" ? m.text : h("span", { class: `move-${m.kind}`, title: m.kind === "auf" ? "AUF" : "en trop" }, m.text),
              ])
            : [d.played ?? ""]),
        ),
      )]),
      ...(d.falseStart
        ? [h("dt", {}, "Faux départ"), h("dd", { class: "muted", title: "Défait avant la formule : ne compte pas en erreur" }, h("code", {}, d.falseStart))]
        : []),
    );
  }

  /** Une erreur du bilan : la formule avec l'erreur en gras rouge, ou l'autre formule faite. */
  function errorBlock(g: ErrorGroup): HTMLElement {
    const times = g.count > 1 ? ` · ${g.count} fois` : "";
    const body = g.other
      ? [h("p", {}, "Autre formule que la tienne :"), h("code", {}, g.other)]
      : g.marks
        ? [h("code", {}, ...g.marks.flatMap((m, i) => [...(i ? [" "] : []), m.kind === "ok" ? m.text : h("span", { class: "move-extra" }, m.text)]))]
        : [h("p", {}, "Mouvements en trop :"), h("code", {}, g.expected)];
    return h("div", { class: "pll-detail-block" }, h("strong", {}, `${pllName(g.id)}${times}`), h("div", { class: "pll-error-body" }, ...body));
  }

  /** « 3 autres erreurs (1 fois chacune) », « 1 erreur (1 fois) »… */
  function isolatedLabel(n: number, others: boolean): string {
    const s = n > 1 ? "s" : "";
    return `${n}${others ? ` autre${s}` : ""} erreur${s} (${n > 1 ? "1 fois chacune" : "1 fois"})`;
  }

  /** Bilan : erreurs faites au moins 2 fois, les autres repliées. */
  function errorsSection(list: readonly PllDone[]): HTMLElement[] {
    const { frequent, isolated } = groupErrors(list);
    if (frequent.length === 0 && isolated.length === 0) return [];
    return [
      ...(frequent.length ? [h("h3", {}, "Erreurs fréquentes"), ...frequent.map(errorBlock)] : []),
      ...(isolated.length
        ? [
            h(
              "details",
              { class: "session" },
              h("summary", {}, isolatedLabel(isolated.length, frequent.length > 0)),
              ...isolated.map(errorBlock),
            ),
          ]
        : []),
    ];
  }

  function undoLast(): void {
    const removed = tracker ? tracker.undo() : manual.pop();
    update(null);
    last.textContent = removed ? `${pllName(removed.id)} annulée.` : "Rien à annuler.";
  }

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
      if (tracker) {
        const time = !lastDone.extra && lastDone.timeMs !== undefined ? ` · ${seconds(lastDone.timeMs)}` : "";
        const verdict = lastDone.other
          ? "autre formule que la tienne (compte en erreur)"
          : lastDone.extra
            ? `${lastDone.extra} mouvement${lastDone.extra > 1 ? "s" : ""} en trop`
            : "sans erreur";
        last.replaceChildren(`${pllName(lastDone.id)}${known} · ${verdict}${time}`, ...(lastDone.extra || lastDone.other ? [detail(lastDone)] : []));
      } else last.textContent = `${pllName(lastDone.id)} cochée.`;
    } else if (!justDone) last.textContent = "";
    undoBtn.hidden = done().length === 0;
  }

  let saved = false;
  async function end(): Promise<void> {
    onEnded();
    clearTimeout(resyncTimer);
    unsubscribe();
    offSolved();
    const list = done();
    const stats = pllStats(list);
    if (list.length && !saved) {
      saved = true;
      const items: TrainingItem[] = stats.map((s) => ({
        label: s.id,
        alg: algs[s.id]?.[0] ?? PLL_CASES.find((c) => c.id === s.id)!.alg,
        reps: s.count,
        timeMs: s.cleanTimeMs ?? 0,
        connected: tracker !== null,
        expectedMoves: s.moves - s.extra,
        ...(tracker ? { moves: s.moves } : {}),
      }));
      const passes = tracker ? list.map((d) => ({ id: d.id, moves: d.moves, extra: d.extra, ...(d.timeMs !== undefined ? { timeMs: Math.round(d.timeMs) } : {}) })) : undefined;
      await addTrainingSession({ date: Date.now(), kind: "pll-run", items, ...(passes ? { passes } : {}) });
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
                ? h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Réussite"), h("th", {}, "Sans erreur"), h("th", {}, "Avec erreurs"), h("th", {}, "Temps moyen"))
                : h("tr", {}, h("th", {}, "PLL"), h("th", {}, "Fois")),
              ...stats.map((s) =>
                h(
                  "tr",
                  {},
                  h("td", {}, pllName(s.id)),
                  ...(tracker ? [rateCell(s), h("td", {}, String(s.clean)), h("td", {}, String(s.withErrors)), h("td", {}, seconds(s.cleanTimeMs))] : [h("td", {}, String(s.count))]),
                ),
              ),
            ),
        missing.length ? h("p", { class: "muted small" }, `Pas faites : ${missing.map((c) => c.id).join(", ")}.`) : null,
        ...(tracker ? errorsSection(list) : []),
        tracker
          ? h(
              "p",
              { class: "muted small" },
              "Avec erreurs = au moins un mouvement en trop par rapport à ta formule (onglet Algos ; les AUF ne comptent pas), ou une tentative ratée puis défaite. Temps moyen = exécution (du premier au dernier mouvement), sur les passages sans erreur seulement. Réussite = part des passages sans erreur : vert à partir de 90 %, orange de 70 à 89 %, rouge en dessous (gris s'il y a moins de 3 passages). Les PLL les moins réussies sont en haut.",
            )
          : null,
      ),
      h("div", { class: "row" }, h("button", { onclick: () => onQuit() }, "Retour")),
    );
  }

  /**
   * Pas de PLL reconnue alors que le joueur s'est arrêté : un mouvement a pu se perdre en
   * route (Bluetooth) et le modèle ne colle plus au vrai cube. On redemande son état au cube.
   */
  let resyncTimer = 0;
  const RESYNC_MS = 1000;
  let lastMoveAt = 0;
  /** Nouveau départ demandé : il se fera sur l'état réel renvoyé par le cube (le modèle a pu dériver). */
  let rebasePending = false;
  /** Onglet quitté : mouvements ignorés ; état du cube à ce moment-là. */
  let paused = false;
  let pausedState: string | null = null;
  function rebaseFromCube(): void {
    rebasePending = true;
    void resyncCube();
  }

  const unsubscribe = onCubeEvent((event) => {
    if (paused || !tracker || (event.type !== "move" && event.type !== "facelets")) return;
    const now = performance.now();
    if (event.type === "facelets" && rebasePending) {
      rebasePending = false;
      tracker.restart(cubeFacelets.get()!);
      if (import.meta.env.DEV) console.log(`[toutes les PLL] nouveau départ sur l'état du cube n°${event.serial ?? "?"}`);
      return;
    }
    if (event.type === "move") rebasePending = false; // déjà reparti : le joueur a continué
    const e = event.type === "move" ? tracker.move(event.move, cubeFacelets.get()!, now) : tracker.observe(cubeFacelets.get()!);
    if (import.meta.env.DEV) {
      // Écart depuis le mouvement précédent : pour repérer une face qui hésite (U U' très rapprochés).
      const what = event.type === "move" ? `${event.move} (+${Math.round(now - lastMoveAt)} ms, n°${event.serial ?? "?"})` : `état du cube n°${event.serial ?? "?"}`;
      const info = e ? ` → ${e.kind === "pll" ? `${e.done.id} (${e.done.extra} en trop)` : e.kind}` : "";
      console.log(`[toutes les PLL] ${what} · ${tracker.since} depuis la dernière PLL${info}`);
    }
    if (event.type === "move") {
      lastMoveAt = now;
      clearTimeout(resyncTimer);
      if (!e && tracker.since >= 6) resyncTimer = window.setTimeout(() => void resyncCube(), RESYNC_MS);
    }
    if (e?.kind === "pll") {
      update(e.done.id);
      noteOther(e.done);
      // Nom de la PLL qui grossit et s'efface : vert sans erreur, orange avec erreurs.
      flashName(pllName(e.done.id), e.done.extra > 0 ? "ko" : "ok");
    }
    else if (e?.kind === "back") last.textContent = "Revenu à l'état d'avant : vas-y, la PLL sera reconnue.";
    else if (e?.kind === "reset") {
      rebaseFromCube();
      last.textContent = "U4 : on repart d'ici.";
    }
    else if (e?.kind === "end") void end();
    else if (e?.kind === "undo") {
      update(null);
      last.textContent = e.done ? `D4 : ${pllName(e.done.id)} annulée.` : "D4 : rien à annuler.";
    }
  });

  // Cube résolu avec le bouton « Résoudre » : on repart de là.
  const offSolved = onHelperSolved(() => {
    const state = cubeFacelets.get();
    if (paused || !tracker || !state) return;
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
          ? "Enchaîne tes PLL dans l'ordre que tu veux : chacune est cochée dès que sa formule est faite (reconnue par son effet sur le cube : AUF libres, tiens le cube comme tu veux). Erreur ? Reviens à l'état d'avant la PLL et recommence, ou fais U4 (4 fois U) pour repartir d'où tu es. Mauvaise reconnaissance ? D4 (4 fois D) l'annule. Fini ? R4 (4 fois R)."
          : "Sans cube : touche la case de chaque PLL que tu viens de faire.",
      ),
      counter,
      last,
      proposal,
      grid,
      h("div", { class: "row" }, ...(tracker ? [restartBtn] : []), undoBtn, endBtn),
    ),
  );
  update(null);

  return {
    pause() {
      paused = true;
      pausedState = cubeFacelets.get();
      clearTimeout(resyncTimer);
      rebasePending = false;
    },
    resume() {
      paused = false;
      const state = cubeFacelets.get();
      // Cube tourné pendant l'absence : la tentative en cours est oubliée, on repart d'ici.
      if (tracker && state && state !== pausedState) {
        tracker.restart(state);
        last.textContent = "Reprise : on repart de l'état actuel du cube.";
      }
    },
    dispose() {
      clearTimeout(resyncTimer);
      unsubscribe();
      offSolved();
    },
  };
}
