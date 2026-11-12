import "./style.css";
import { startRouter, type Route } from "./app/router";
import { getDb } from "./storage/db";
import { requestPersistence } from "./storage/persistence";
import { loadSolves } from "./storage/solves";
import { mountCubeButton } from "./ui/cube-button";
import { mountNotationButton } from "./ui/notation-sheet";
import { casesView } from "./ui/views/cases";
import { settingsView } from "./ui/views/settings";
import { solveView } from "./ui/views/solve";
import { statsView } from "./ui/views/stats";
import { timerView } from "./ui/views/timer";
import { trainingView } from "./ui/views/training";

const routes: Route[] = [
  { path: "chrono", label: "Chrono", icon: "⏱️", view: timerView },
  {
    path: "entrainement",
    label: "Entraînement",
    icon: "🎯",
    view: trainingView,
  },
  { path: "algos", label: "Algos", icon: "📚", view: casesView },
  { path: "stats", label: "Stats", icon: "📊", view: statsView },
  { path: "reglages", label: "Réglages", icon: "⚙️", view: settingsView },
  { path: "solve", tab: "stats", view: solveView },
];

async function main(): Promise<void> {
  await getDb();
  await loadSolves();
  // Sur Android, Chrome accorde souvent la persistance automatiquement
  // (surtout une fois l'appli installée) ; sinon on réessaie depuis les réglages.
  void requestPersistence();

  mountCubeButton(document.getElementById("app")!);
  mountNotationButton(document.getElementById("app")!);
  startRouter(routes, document.getElementById("view")!, document.getElementById("tabbar")!);
}

void main();
