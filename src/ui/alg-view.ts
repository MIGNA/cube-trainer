// Affichage d'une formule avec ses triggers soulignés en couleur.
// interactive : chaque trigger peut recevoir le focus (toucher) et affiche alors
// son nom dans une bulle (CSS) — à éviter à l'intérieur d'un lien.

import { findTriggers } from "../cube/triggers";
import { h } from "./dom";

export function algView(alg: string, options: { interactive?: boolean; class?: string } = {}): HTMLElement {
  const code = h("code", { class: options.class });
  fillAlg(code, alg, options.interactive ?? false);
  return code;
}

/** Remplit (ou remplace) le contenu d'un élément avec la formule découpée. */
export function fillAlg(el: HTMLElement, alg: string, interactive = false): void {
  el.replaceChildren(
    ...findTriggers(alg).flatMap((s, i) => {
      const text = s.moves.join(" ");
      const name = s.trigger ? s.trigger.name + (s.left ? " (main gauche)" : "") : "";
      const part = s.trigger
        ? h("span", { class: `trig trig-${s.trigger.family}`, title: name, "data-name": name, tabindex: interactive ? "0" : null }, text)
        : text;
      return i > 0 ? [" ", part] : [part];
    }),
  );
}
