// Routeur par hash (#/chrono, #/stats…) : fonctionne hors ligne et sur GitHub Pages
// sans configuration serveur.

import { h } from "../ui/dom";

export interface View {
  title: string;
  /** Construit la vue dans `container`. Peut renvoyer une fonction de nettoyage appelée en quittant la vue. */
  mount(container: HTMLElement): (() => void) | void;
}

export interface Route {
  path: string;
  label: string;
  icon: string;
  view: View;
}

export function startRouter(routes: Route[], outlet: HTMLElement, nav: HTMLElement): void {
  const links = new Map<string, HTMLAnchorElement>();
  for (const route of routes) {
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
    const path = location.hash.replace(/^#\/?/, "");
    const route = routes.find((r) => r.path === path) ?? routes[0];

    cleanup?.();
    outlet.replaceChildren();
    cleanup = route.view.mount(outlet) ?? undefined;

    for (const [p, link] of links) {
      link.classList.toggle("active", p === route.path);
      if (p === route.path) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
    document.title = `${route.view.title} · Cube Trainer`;
  }

  window.addEventListener("hashchange", render);
  render();
}
