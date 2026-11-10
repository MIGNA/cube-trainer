// Dessin SVG d'un mouvement (page Notation) : cube de trois quarts, jaune en haut,
// vert devant ; la couche qui tourne en couleur, le reste estompé, flèche du sens.

import { inLayer, moveDiagram, project, visibleStickers, type Vec3 } from "../cube/move-diagram";
import { COLORS } from "./case-svg";

const NS = "http://www.w3.org/2000/svg";
const ARROW = "#f4f6f8";
const HALO = "#111418";

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const points = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(3)},${b.toFixed(3)}`).join(" ");

/** Cube de trois quarts ; `lit` dit quels autocollants restent en couleur (les autres sont estompés). */
function cube(viewBox: string, size: number, lit: (cubie: Vec3) => boolean): SVGSVGElement {
  const [, , w, hgt] = viewBox.split(" ").map(Number);
  const svg = el("svg", { viewBox, width: size, height: (size * hgt) / w }) as SVGSVGElement;
  for (const s of visibleStickers()) {
    // Autocollant légèrement rétréci vers son centre pour laisser voir les joints.
    const c = s.corners.reduce<number[]>((a, p) => a.map((v, i) => v + p[i] / 4), [0, 0, 0]);
    const inset = s.corners.map((p) => project(p.map((v, i) => c[i] + (v - c[i]) * 0.86) as Vec3));
    svg.append(el("polygon", { points: points(inset), fill: COLORS[s.face], opacity: lit(s.cubie) ? 1 : 0.22 }));
  }
  return svg;
}

/** Petit cube sans flèche (icône du bouton Notation). */
export function cubeIcon(size = 24): SVGSVGElement {
  const svg = cube("-2.7 -3.1 5.4 6.2", size, () => true);
  svg.setAttribute("aria-hidden", "true");
  return svg;
}

export function moveSvg(move: string, size = 110): SVGSVGElement {
  const d = moveDiagram(move);
  const svg = cube("-2.9 -3.3 5.8 6.6", size, (cubie) => inLayer(d, cubie));
  svg.setAttribute("class", "move-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Mouvement ${move}`);

  // Flèche : un liseré sombre pour le contraste, puis le trait clair et la pointe.
  const p2 = d.path.map(project);
  const [ax, ay] = p2[p2.length - 2];
  const [bx, by] = p2[p2.length - 1];
  const len = Math.hypot(bx - ax, by - ay);
  const [ux, uy] = [(bx - ax) / len, (by - ay) / len];
  const [s, w] = [0.55, 0.32];
  const head = points([
    [bx + ux * 0.25, by + uy * 0.25],
    [bx - ux * s - uy * w, by - uy * s + ux * w],
    [bx - ux * s + uy * w, by - uy * s - ux * w],
  ]);
  for (const [color, width] of [[HALO, 0.34], [ARROW, 0.16]] as const) {
    svg.append(el("polyline", { points: points(p2), fill: "none", stroke: color, "stroke-width": width, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    svg.append(el("polygon", { points: head, fill: color, stroke: color, "stroke-width": width - 0.16, "stroke-linejoin": "round" }));
  }
  if (d.twice) {
    const [tx, ty] = p2[0];
    const label = el("text", { x: tx - 0.5, y: ty + 0.2, "font-size": 1.1, "font-weight": 700, fill: ARROW, stroke: HALO, "stroke-width": 0.18, "paint-order": "stroke", "text-anchor": "end" });
    label.textContent = "×2";
    svg.append(label);
  }
  return svg;
}
