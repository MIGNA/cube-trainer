// Dessin SVG d'un schéma de dernière couche (vue de dessus).
// OLL : autocollants de la couleur du dessus en jaune, le reste en gris.
// Croix (2-look) : seules les arêtes comptent, les coins restent gris.
// PLL : couleurs des bords + flèches de permutation.

import type { LastLayerView, SideFace } from "../cube/case-diagram";
import type { Face } from "../cube/facelets";
import type { CaseKind } from "../cube/cases";

const NS = "http://www.w3.org/2000/svg";

// Repère du schéma : dernière couche (jaune) en haut, vert devant.
// Repère joueur : jaune en haut, vert devant → orange à droite, rouge à gauche
// (schéma de couleurs standard ; le cube GAN, blanc en haut, a le rouge à droite).
export const COLORS: Record<Face, string> = { U: "#ffd500", D: "#f4f4f4", F: "#00a651", R: "#ff7a1a", B: "#1e64d6", L: "#d7263d" };
const GRAY = "#4a525e";
const OFF = "#2a3039";

const CELL = 10;
const EDGE = 4; // épaisseur des bords
const PAD = 1; // espace entre bords et face
const O = EDGE + PAD; // origine de la face U
const SIZE = 2 * O + 3 * CELL;

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

const center = (cell: number) => [O + (cell % 3) * CELL + CELL / 2, O + Math.floor(cell / 3) * CELL + CELL / 2];

/** Flèche de a vers b (pointe des deux côtés si `both`), raccourcie pour ne pas toucher les centres. */
function arrow(a: number, b: number, both: boolean): SVGElement {
  const [x1, y1] = center(a);
  const [x2, y2] = center(b);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const cut = 2.2;
  const [sx, sy, ex, ey] = [x1 + ux * cut, y1 + uy * cut, x2 - ux * cut, y2 - uy * cut];
  const g = el("g", { stroke: "#111418", fill: "#111418", "stroke-width": 0.9, "stroke-linecap": "round" });
  g.append(el("line", { x1: sx, y1: sy, x2: ex, y2: ey }));
  const head = (px: number, py: number, dx: number, dy: number) => {
    const s = 2.4;
    const w = 1.4;
    const pts = [
      [px, py],
      [px - dx * s - dy * w, py - dy * s + dx * w],
      [px - dx * s + dy * w, py - dy * s - dx * w],
    ];
    return el("polygon", { points: pts.map((p) => p.join(",")).join(" "), stroke: "none" });
  };
  g.append(head(ex, ey, ux, uy));
  if (both) g.append(head(sx, sy, -ux, -uy));
  return g;
}

/**
 * Schéma de dernière couche vu de dessus. `only` (en mode "pll") ne garde en couleur,
 * avec leurs flèches, que les arêtes ou que les coins (méthode débutant).
 */
export function caseSvg(view: LastLayerView, kind: CaseKind, size = 72, only?: "edges" | "corners"): SVGSVGElement {
  const svg = el("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: size, height: size, class: "case-svg" }) as SVGSVGElement;
  const hidden = (corner: boolean) => (only === "edges" && corner) || (only === "corners" && !corner);
  const color = (f: Face, isSide: boolean, corner = false) =>
    kind === "pll"
      ? hidden(corner)
        ? isSide
          ? OFF
          : GRAY
        : COLORS[f]
      : f === "U" && !(kind === "eo" && corner)
        ? COLORS.U
        : isSide
          ? OFF
          : GRAY;

  view.top.forEach((f, i) => {
    const corner = i % 2 === 0 && i !== 4;
    svg.append(
      el("rect", { x: O + (i % 3) * CELL + 0.5, y: O + Math.floor(i / 3) * CELL + 0.5, width: CELL - 1, height: CELL - 1, rx: 1.2, fill: i === 4 ? COLORS[f] : color(f, false, corner) }),
    );
  });

  const strip = (side: SideFace, k: number, f: Face) => {
    const along = O + k * CELL + 0.5;
    const rect =
      side === "B"
        ? { x: along, y: 0, width: CELL - 1, height: EDGE }
        : side === "F"
          ? { x: along, y: SIZE - EDGE, width: CELL - 1, height: EDGE }
          : side === "L"
            ? { x: 0, y: along, width: EDGE, height: CELL - 1 }
            : { x: SIZE - EDGE, y: along, width: EDGE, height: CELL - 1 };
    svg.append(el("rect", { ...rect, rx: 0.8, fill: color(f, true, k !== 1) }));
  };
  for (const side of ["B", "F", "L", "R"] as SideFace[]) view.sides[side].forEach((f, k) => strip(side, k, f));

  if (kind === "pll") {
    const drawn = new Set<string>();
    const isCorner = (cell: number) => cell % 2 === 0 && cell !== 4;
    for (const [a, b] of view.arrows.filter(([cell]) => !hidden(isCorner(cell)))) {
      if (drawn.has(`${b}>${a}`)) continue;
      const both = view.arrows.some(([c, d]) => c === b && d === a);
      drawn.add(`${a}>${b}`);
      svg.append(arrow(a, b, both));
    }
  }
  return svg;
}
