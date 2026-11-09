// Petit helper pour créer des éléments DOM sans framework.
//   h("button", { class: "primary", onclick: () => … }, "Texte")

type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key in el) {
      Reflect.set(el, key, value);
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }

  for (const child of children) {
    if (child == null || child === false) continue;
    el.append(typeof child === "number" ? String(child) : child);
  }
  return el;
}
