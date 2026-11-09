import "./style.css";
import { startRouter, type Route } from "./app/router";
import { getDb } from "./storage/db";
import { requestPersistence } from "./storage/persistence";
import { placeholderView } from "./ui/views/placeholder";
import { settingsView } from "./ui/views/settings";

const routes: Route[] = [
  {
    path: "chrono",
    label: "Chrono",
    icon: "⏱️",
    view: placeholderView("Chrono", "Le chrono avec ao5 / ao12 arrive à l'étape 2."),
  },
  {
    path: "entrainement",
    label: "Entraînement",
    icon: "🎯",
    view: placeholderView("Entraînement", "Le programme quotidien (OLL/PLL, drills de croix, streak) arrive aux étapes 5 à 7."),
  },
  {
    path: "stats",
    label: "Stats",
    icon: "📊",
    view: placeholderView("Statistiques", "L'historique et les statistiques arrivent avec le chrono."),
  },
  { path: "reglages", label: "Réglages", icon: "⚙️", view: settingsView },
];

async function main(): Promise<void> {
  await getDb();
  // Sur Android, Chrome accorde souvent la persistance automatiquement
  // (surtout une fois l'appli installée) ; sinon on réessaie depuis les réglages.
  void requestPersistence();

  startRouter(routes, document.getElementById("view")!, document.getElementById("tabbar")!);
}

void main();
