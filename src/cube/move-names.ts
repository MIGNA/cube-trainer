// Traduction en français d'un mouvement de face, pour les débutants :
// R → « face de droite, vers le haut », f → « deux couches de devant, … ». Le geste est décrit depuis la face avant
// (comme sur la page Notation) : R fait monter l'avant, U le fait partir à gauche…

const FACE: Record<string, string> = {
  R: "face de droite",
  L: "face de gauche",
  U: "face du haut",
  D: "face du bas",
  F: "face de devant",
  B: "face de derrière",
};

// Geste du quart de tour normal, puis du quart de tour inverse (').
const GESTURE: Record<string, [string, string]> = {
  R: ["vers le haut", "vers le bas"],
  L: ["vers le bas", "vers le haut"],
  U: ["vers la gauche", "vers la droite"],
  D: ["vers la droite", "vers la gauche"],
  F: ["sens des aiguilles d'une montre", "sens inverse des aiguilles d'une montre"],
  B: ["le haut part à gauche", "le haut part à droite"],
};

/**
 * Description complète d'un mouvement de face (R) ou large (r = deux couches) ;
 * null pour les autres (M, x…).
 */
export function describeMove(move: string): string | null {
  const m = /^([URFDLBurfdlb])(2'?|'|)$/.exec(move);
  if (!m) return null;
  const [, letter, suffix] = m;
  const face = letter.toUpperCase();
  const gesture = suffix.startsWith("2") ? "demi-tour" : GESTURE[face][suffix === "'" ? 1 : 0];
  const where = letter === face ? FACE[face] : `deux couches ${FACE[face].replace("face ", "")}`;
  return `${where}, ${gesture}`;
}
