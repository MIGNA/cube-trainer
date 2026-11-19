// Séances d'entraînement enregistrées (échauffement…).

import { getDb, type TrainingSession } from "./db";

/** Toutes les séances, de la plus ancienne à la plus récente. */
export async function allTrainingSessions(): Promise<TrainingSession[]> {
  return (await getDb()).getAllFromIndex("training", "by-date");
}

export async function addTrainingSession(session: Omit<TrainingSession, "id">): Promise<void> {
  await (await getDb()).add("training", session);
}
