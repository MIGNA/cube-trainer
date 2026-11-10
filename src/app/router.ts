// Routeur par hash (#/chrono, #/stats…) : fonctionne hors ligne et sur GitHub Pages
// sans configuration serveur.

import { h } from "../ui/dom";

export interface View {
  title: string;
  /**
   * Construit la vue dans `container`. Peut renvoyer une fonction de nettoyage appelée en quittant la vue.
   * `params` = segments après le chemin (#/solve/12 → ["12"]).
   */
  mount(container: HTMLElement, params: string[]): (() => void) | void;
}

export interface Route {
  path: string;
  view: View;
  /** Onglet de la barre du bas ; une route sans onglet (page de détail) indique `tab` à surligner. */
  label?: string;
  icon?: string;
  tab?: string;
}

export function startRouter(routes: Route[], outlet: HTMLElement, nav: HTMLElement): void {
  const links = new Map<string, HTMLAnchorElement>();
  for (const route of routes) {
    if (!route.label) continue;
    const link = h(
      "a",
      { href: `#/${route.path}`, class: "tab" },
      h("span", { class: "tab-icon", "aria-hidden": "true" }, route.icon),
      h("span", { class: "tab-label" }, route.label),
    );
    links.set(route.path, link);
    nav.append(link);
  }

  let cleanup: (() => void) | undefined;

  function render(): void {
    const [path, ...params] = location.hash.replace(/^#\/?/, "").split("/");
    const route = routes.find((r) => r.path === path) ?? routes[0];
    const tab = route.tab ?? route.path;

    cleanup?.();
    outlet.replaceChildren();
    window.scrollTo(0, 0);
    cleanup = route.view.mount(outlet, params) ?? undefined;

    for (const [p, link] of links) {
      link.classList.toggle("active", p === tab);
      if (p === tab) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = `${route.view.title} · Cube Trainer`;
  }

  window.addEventListener("hashchange", render);
  render();
}
