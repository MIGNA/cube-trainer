// Accès aux solves. Tout l'historique est gardé en mémoire dans `solves`
// (du plus ancien au plus récent) : quelques milliers d'entrées, c'est négligeable.

import { signal } from "../app/signal";
import { getDb, type Penalty, type Solve } from "./db";

export const solves = signal<readonly Solve[]>([]);

export async function loadSolves(): Promise<void> {
  const db = await getDb();
  solves.set(await db.getAllFromIndex("solves", "by-date"));
}

export async function addSolve(solve: Omit<Solve, "id">): Promise<Solve> {
  const db = await getDb();
  const id = await db.add("solves", solve as Solve);
  const saved = { ...solve, id };
  solves.update((list) => [...list, saved]);
  return saved;
}

export async function setPenalty(id: number, penalty: Penalty): Promise<void> {
  const db = await getDb();
  const solve = await db.get("solves", id);
  if (!solve) return;
  const updated = { ...solve, penalty };
  await db.put("solves", updated);
  solves.update((list) => list.map((s) => (s.id === id ? updated : s)));
}

export async function deleteSolve(id: number): Promise<void> {
  const db = await getDb();
  await db.delete("solves", id);
  solves.update((list) => list.filter((s) => s.id !== id));
}
