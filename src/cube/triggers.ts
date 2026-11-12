// Repérage des « triggers » dans une formule : petits enchaînements classiques
// (sexy move, sledgehammer, Sune…) qui reviennent dans beaucoup d'algos.
// Logique pure sur le texte : la formule est découpée en segments, chacun étant
// soit un trigger reconnu, soit des mouvements ordinaires.

export type TriggerFamily = "sexy" | "sledge" | "sune";

export interface Trigger {
  id: string;
  name: string;
  /** Famille, pour la couleur d'affichage. */
  family: TriggerFamily;
  /** Formule de référence (main droite). */
  alg: string;
}

export interface AlgSegment {
  /** Mouvements tels qu'écrits dans la formule (parenthèses comprises). */
  moves: string[];
  trigger?: Trigger;
  /** Version main gauche du trigger. */
  left?: boolean;
}

export const TRIGGERS: readonly Trigger[] = [
  { id: "sune", name: "Sune", family: "sune", alg: "R U R' U R U2 R'" },
  { id: "antisune", name: "Anti-Sune (la chaise)", family: "sune", alg: "R U2 R' U' R U' R'" },
  { id: "sexy", name: "Sexy move", family: "sexy", alg: "R U R' U'" },
  { id: "sexy-inv", name: "Sexy inversé", family: "sexy", alg: "U R U' R'" },
  { id: "sledge", name: "Sledgehammer", family: "sledge", alg: "R' F R F'" },
  { id: "hedge", name: "Hedgeslammer", family: "sledge", alg: "F R' F' R" },
];

/** Mouvement ramené à sa forme de comparaison : sans parenthèses, Rw → R, r → R, U2' → U2. */
function normalize(move: string): string {
  let m = move.replace(/[()]/g, "").replace(/^([URFDLB])w/, (_, f: string) => f.toLowerCase());
  m = m.replace(/^[urfdlb]/, (f) => f.toUpperCase());
  return m.replace(/2'$/, "2");
}

/** Symétrique gauche/droite : R ↔ L, sens inversé (R U R' U' → L' U' L U). */
function mirror(move: string): string {
  const face = { R: "L", L: "R" }[move[0]] ?? move[0];
  const suffix = move.slice(1);
  return face + (suffix === "" ? "'" : suffix === "'" ? "" : suffix);
}

/** Formule miroir (main gauche ↔ main droite) : R U R' U' → L' U' L U. */
export function mirrorAlg(alg: string): string {
  return alg.trim().split(/\s+/).filter(Boolean).map(mirror).join(" ");
}

interface Pattern {
  trigger: Trigger;
  left: boolean;
  moves: string[];
}

// Les plus longs d'abord : à une position donnée, on préfère la Sune au sexy move.
const PATTERNS: Pattern[] = TRIGGERS.flatMap((trigger) => {
  const moves = trigger.alg.split(" ");
  return [
    { trigger, left: false, moves },
    { trigger, left: true, moves: moves.map(mirror) },
  ];
}).sort((a, b) => b.moves.length - a.moves.length);

/** Découpe une formule en segments, triggers repérés de gauche à droite. */
export function findTriggers(alg: string): AlgSegment[] {
  const raw = alg.trim().split(/\s+/).filter(Boolean);
  const norm = raw.map(normalize);
  const segments: AlgSegment[] = [];
  let plain: string[] = [];
  let i = 0;
  while (i < raw.length) {
    const p = PATTERNS.find((p) => p.moves.every((m, k) => norm[i + k] === m));
    if (!p) {
      plain.push(raw[i++]);
      continue;
    }
    if (plain.length) segments.push({ moves: plain });
    plain = [];
    segments.push({ moves: raw.slice(i, i + p.moves.length), trigger: p.trigger, left: p.left });
    i += p.moves.length;
  }
  if (plain.length) segments.push({ moves: plain });
  return segments;
}
