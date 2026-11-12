// Séances d'entraînement enregistrées (échauffement…).

import { getDb, type TrainingSession } from "./db";

export async function addTrainingSession(session: Omit<TrainingSession, "id">): Promise<void> {
  await (await getDb()).add("training", session);
}
