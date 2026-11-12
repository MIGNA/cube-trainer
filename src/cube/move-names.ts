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

// Rotations de tout le cube : quart de tour normal, inverse ('), demi-tour (2).
const ROTATION: Record<string, [string, string, string]> = {
  x: ["la face de devant passe en haut", "la face de devant passe en bas", "demi-tour vers le haut"],
  y: ["la face de droite passe devant", "la face de gauche passe devant", "demi-tour, la face de derrière passe devant"],
  z: ["le haut passe à droite", "le haut passe à gauche", "demi-tour, le haut passe en bas"],
};

/**
 * Description complète d'un mouvement de face (R), large (r = deux couches)
 * ou d'une rotation du cube (y) ; null pour les tranches (M, E, S).
 */
export function describeMove(move: string): string | null {
  const rot = /^([xyz])(2'?|'|)$/.exec(move);
  if (rot) return `tourner tout le cube : ${ROTATION[rot[1]][rot[2].startsWith("2") ? 2 : rot[2] === "'" ? 1 : 0]}`;
  const m = /^([URFDLBurfdlb])(2'?|'|)$/.exec(move);
  if (!m) return null;
  const [, letter, suffix] = m;
  const face = letter.toUpperCase();
  const gesture = suffix.startsWith("2") ? "demi-tour" : GESTURE[face][suffix === "'" ? 1 : 0];
  const where = letter === face ? FACE[face] : `deux couches ${FACE[face].replace("face ", "")}`;
  return `${where}, ${gesture}`;
}
