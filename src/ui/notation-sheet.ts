// Notation par-dessus la page courante : bouton rond en haut à gauche de toutes les
// pages (masqué pendant l'inspection et le solve, comme le bouton Bluetooth) et
// panneau qui monte du bas. La page en dessous reste telle quelle.
//
// Bouton retour d'Android : à l'ouverture on ajoute une entrée d'historique (même
// adresse, donc pas de changement de page) ; « retour » la retire et ferme le panneau.

import { h } from "./dom";
import { cubeIcon } from "./move-svg";
import { notationContent } from "./views/notation";

let sheet: { close: () => void } | null = null;

function close(fromHistory: boolean): void {
  if (!sheet) return;
  // Fermé par la croix ou le fond : on retire nous-mêmes l'entrée d'historique ajoutée.
  if (!fromHistory && (history.state as { sheet?: string } | null)?.sheet === "notation") {
    history.back(); // déclenche popstate → close(true)
    return;
  }
  sheet.close();
  sheet = null;
}

window.addEventListener("popstate", () => close(true));

export function openNotation(): void {
  if (sheet) return;
  const closeBtn = h("button", { class: "secondary sheet-close", type: "button", "aria-label": "Fermer", onclick: () => close(false) }, "✕");
  const backdrop = h("div", { class: "sheet-backdrop", onclick: () => close(false) });
  const panel = h(
    "div",
    { class: "sheet", role: "dialog", "aria-modal": "true", "aria-label": "Notation" },
    h("div", { class: "sheet-head" }, h("h1", {}, "Notation"), closeBtn),
    h("div", { class: "sheet-body" }, ...notationContent()),
  );
  const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);

  document.body.append(backdrop, panel);
  document.body.classList.add("sheet-open");
  document.addEventListener("keydown", onKey);
  history.pushState({ ...(history.state as object | null), sheet: "notation" }, "");
  closeBtn.focus();

  sheet = {
    close() {
      backdrop.remove();
      panel.remove();
      document.body.classList.remove("sheet-open");
      document.removeEventListener("keydown", onKey);
    },
  };
}

export function mountNotationButton(parent: HTMLElement): void {
  parent.append(
    h("button", { class: "notation-button", type: "button", title: "Notation", "aria-label": "Notation", onclick: () => openNotation() }, cubeIcon(24)),
  );
}
