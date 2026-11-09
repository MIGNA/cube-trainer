// Mélanges.
// - generateScramble() : mélange officiel WCA « random-state » via cubing.js
//   (chargé à la demande, calcul dans un worker). Le premier prend ~1 s, d'où
//   un mélange d'avance gardé en réserve.
// - randomMoveScramble() : secours si cubing.js échoue (20 mouvements aléatoires).

let next: Promise<string> | null = null;

async function computeScramble(): Promise<string> {
  try {
    const { randomScrambleForEvent } = await import("cubing/scramble");
    return (await randomScrambleForEvent("333")).toString();
  } catch (err) {
    console.warn("cubing.js indisponible, mélange aléatoire simple", err);
    return randomMoveScramble();
  }
}

/** Renvoie un mélange WCA et prépare le suivant en arrière-plan. */
export async function generateScramble(): Promise<string> {
  const current = next ?? computeScramble();
  next = computeScramble();
  return current;
}

const FACES = ["U", "D", "R", "L", "F", "B"] as const;
const AXIS: Record<(typeof FACES)[number], number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const SUFFIXES = ["", "'", "2"] as const;

export function randomMoveScramble(length = 20, random: () => number = Math.random): string {
  const moves: string[] = [];
  let last: (typeof FACES)[number] | null = null;
  let beforeLast: (typeof FACES)[number] | null = null;

  while (moves.length < length) {
    const face = FACES[Math.floor(random() * FACES.length)];
    // Pas deux fois la même face d'affilée (R R'),
    // ni la même face séparée par sa face opposée (R L R).
    if (face === last) continue;
    if (last && beforeLast && face === beforeLast && AXIS[face] === AXIS[last]) continue;

    moves.push(face + SUFFIXES[Math.floor(random() * SUFFIXES.length)]);
    beforeLast = last;
    last = face;
  }
  return moves.join(" ");
}
