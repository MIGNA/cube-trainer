// Mélange par mouvements aléatoires (provisoire).
// Les mélanges officiels WCA sont « random-state » ; ils arriveront avec cubing.js
// à l'étape 3. Pour l'entraînement, un mélange aléatoire de 20 mouvements suffit.

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
