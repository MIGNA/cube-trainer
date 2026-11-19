// Effet visuel de réussite : un texte apparaît au milieu de l'écran, grossit et s'efface
// (animation CSS `.flash-name`, ~1,5 s). Ne bloque pas les touchers.

export function flashName(text: string, tone: "ok" | "ko" = "ok"): void {
  const el = document.createElement("div");
  el.className = `flash-name ${tone}`;
  el.textContent = text;
  el.setAttribute("aria-hidden", "true");
  document.body.append(el);
  el.addEventListener("animationend", () => el.remove());
  // Filet de sécurité si l'animation ne se lance pas (onglet en arrière-plan…).
  window.setTimeout(() => el.remove(), 3000);
}
