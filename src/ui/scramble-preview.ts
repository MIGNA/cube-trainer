// Aperçu du mélange : patron à plat du cube mélangé (comme csTimer), dans l'orientation
// des mélanges WCA (blanc en haut, vert devant). Haut au-dessus, puis gauche / devant /
// droite / arrière, bas en dessous.

import { SOLVED, applyAlg, type Face } from "../cube/facelets";
import { COLORS } from "./case-svg";

const NS = "http://www.w3.org/2000/svg";
const CELL = 10;
const GAP = 3; // espace entre les faces

// Le mélange est dans le repère du cube (blanc en haut, rouge à droite) ; COLORS est dans
// le repère joueur (jaune en haut, orange à droite) → U↔D et R↔L échangés.
const CUBE_COLORS: Record<Face, string> = { U: COLORS.D, D: COLORS.U, R: COLORS.L, L: COLORS.R, F: COLORS.F, B: COLORS.B };

// Position de chaque face dans le patron (colonne, ligne), en faces de 3 cases.
const LAYOUT: Record<Face, [number, number]> = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
// Ordre des faces dans la chaîne de 54 facelets (Kociemba).
const ORDER: Face[] = ["U", "R", "F", "D", "L", "B"];

const FACE = 3 * CELL + GAP;

/** Patron SVG de l'état obtenu en appliquant le mélange à un cube résolu. */
export function scramblePreview(scramble: string): SVGSVGElement {
  const state = applyAlg(SOLVED, scramble);
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${4 * FACE - GAP} ${3 * FACE - GAP}`);
  svg.setAttribute("class", "scramble-preview");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Aperçu du cube mélangé");
  ORDER.forEach((face, f) => {
    const [col, row] = LAYOUT[face];
    for (let i = 0; i < 9; i++) {
      const rect = document.createElementNS(NS, "rect");
      rect.setAttribute("x", String(col * FACE + (i % 3) * CELL + 0.5));
      rect.setAttribute("y", String(row * FACE + Math.floor(i / 3) * CELL + 0.5));
      rect.setAttribute("width", String(CELL - 1));
      rect.setAttribute("height", String(CELL - 1));
      rect.setAttribute("rx", "1.2");
      rect.setAttribute("fill", CUBE_COLORS[state[f * 9 + i] as Face]);
      svg.append(rect);
    }
  });
  return svg;
}
