// Bouton rond Bluetooth en haut à droite de toutes les pages.
// Non connecté / erreur → lance la connexion du cube GAN ; connecté → ouvre les réglages.
// Masqué pendant l'inspection et le solve (body.timing, voir style.css).

import { connectGanCube, cubeStatus, isWebBluetoothAvailable, type CubeStatus } from "../ble/cube-service";
import { h } from "./dom";

const NS = "http://www.w3.org/2000/svg";

function bluetoothIcon(): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "22");
  svg.setAttribute("height", "22");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "polyline");
  path.setAttribute("points", "6.5 7 17.5 17 12 22 12 2 17.5 7 6.5 17");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

const TITLES: Record<CubeStatus["state"], string> = {
  disconnected: "Connecter le cube",
  connecting: "Connexion…",
  connected: "Cube connecté (réglages)",
  error: "Échec de connexion : réessayer",
};

export function mountCubeButton(parent: HTMLElement): void {
  const button = h("button", { class: "cube-button", type: "button" }, bluetoothIcon());
  button.addEventListener("click", () => {
    const s = cubeStatus.get();
    if (s.state === "connected") location.hash = "#/reglages";
    else if (s.state !== "connecting") void connectGanCube();
  });

  cubeStatus.subscribe((s) => {
    button.dataset.state = s.state;
    const title = s.state === "error" ? `${TITLES.error} (${s.message})` : TITLES[s.state];
    button.title = title;
    button.setAttribute("aria-label", title);
  });

  // Sans Web Bluetooth (navigateur non compatible), le bouton ne servirait à rien.
  button.hidden = !isWebBluetoothAvailable();
  parent.append(button);
}
