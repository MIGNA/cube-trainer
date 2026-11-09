import type { View } from "../../app/router";
import { h } from "../dom";

/** Vue temporaire pour les écrans pas encore développés. */
export function placeholderView(title: string, text: string): View {
  return {
    title,
    mount(container) {
      container.append(
        h("h1", {}, title),
        h("section", { class: "card" }, h("p", { class: "muted" }, text)),
      );
    },
  };
}
