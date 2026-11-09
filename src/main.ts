// Étape 0 : test de faisabilité Bluetooth avec un cube GAN.
// Page jetable : elle sera remplacée par l'appli réelle à l'étape 1.

import "./style.css";
import { connectGanCube, type GanCubeConnection, type GanCubeEvent, type MacAddressProvider } from "gan-web-bluetooth";

const SOLVED_FACELETS = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";
const MAC_STORAGE_KEY = "cube-trainer:last-mac";
const MAX_MOVES_SHOWN = 40;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const ui = {
  connect: $<HTMLButtonElement>("connect"),
  disconnect: $<HTMLButtonElement>("disconnect"),
  mac: $<HTMLInputElement>("mac"),
  status: $("status"),
  name: $("name"),
  deviceMac: $("device-mac"),
  hardware: $("hardware"),
  battery: $("battery"),
  solved: $("solved"),
  reqFacelets: $<HTMLButtonElement>("req-facelets"),
  reqReset: $<HTMLButtonElement>("req-reset"),
  moves: $("moves"),
  moveCount: $("move-count"),
  log: $("log"),
};

let conn: GanCubeConnection | null = null;
let moves: string[] = [];
let moveCount = 0;

try {
  ui.mac.value = localStorage.getItem(MAC_STORAGE_KEY) ?? "";
} catch {
  // stockage indisponible : pas grave pour un test
}

function log(message: string): void {
  const time = new Date().toLocaleTimeString("fr-FR");
  ui.log.textContent = `${time}  ${message}\n${ui.log.textContent ?? ""}`;
}

function setStatus(text: string, kind: "" | "ok" | "err" = ""): void {
  ui.status.textContent = text;
  ui.status.className = `status ${kind}`;
}

function setConnected(connected: boolean): void {
  ui.connect.disabled = connected;
  ui.disconnect.disabled = !connected;
  ui.reqFacelets.disabled = !connected;
  ui.reqReset.disabled = !connected;
}

// Appelée par la bibliothèque pour obtenir la MAC du cube (clé de déchiffrement).
// 1er appel : on laisse la détection automatique essayer, sauf si une MAC est saisie.
// Appel de secours (isFallbackCall) : on utilise la saisie, sinon échec.
const macProvider: MacAddressProvider = async (_device, isFallbackCall) => {
  const typed = ui.mac.value.trim().toUpperCase();
  if (typed) return typed;
  if (isFallbackCall) {
    log("Détection automatique de la MAC impossible.");
    return null;
  }
  return null;
};

function handleEvent(event: GanCubeEvent): void {
  switch (event.type) {
    case "MOVE":
      moveCount++;
      moves.push(event.move);
      if (moves.length > MAX_MOVES_SHOWN) moves = moves.slice(-MAX_MOVES_SHOWN);
      ui.moves.textContent = moves.join(" ");
      ui.moveCount.textContent = `(${moveCount})`;
      break;
    case "FACELETS": {
      const solved = event.facelets === SOLVED_FACELETS;
      ui.solved.textContent = solved ? "oui ✅" : "non";
      break;
    }
    case "BATTERY":
      ui.battery.textContent = `${event.batteryLevel} %`;
      log(`Batterie : ${event.batteryLevel} %`);
      break;
    case "HARDWARE":
      ui.hardware.textContent = [event.hardwareName, event.hardwareVersion && `hw ${event.hardwareVersion}`, event.softwareVersion && `sw ${event.softwareVersion}`]
        .filter(Boolean)
        .join(" · ") || "—";
      log(`Matériel : ${JSON.stringify(event)}`);
      break;
    case "GYRO":
      // trop fréquent pour être journalisé
      break;
    case "DISCONNECT":
      log("Cube déconnecté.");
      setStatus("Déconnecté", "err");
      setConnected(false);
      conn = null;
      break;
  }
}

ui.connect.addEventListener("click", async () => {
  if (!("bluetooth" in navigator)) {
    setStatus("Web Bluetooth indisponible dans ce navigateur (utilise Chrome Android, en HTTPS ou localhost).", "err");
    return;
  }
  setStatus("Connexion…");
  try {
    conn = await connectGanCube(macProvider);
    log(`Connecté à ${conn.deviceName} (${conn.deviceMAC})`);
    try {
      localStorage.setItem(MAC_STORAGE_KEY, conn.deviceMAC);
    } catch {
      // ignore
    }
    ui.name.textContent = conn.deviceName;
    ui.deviceMac.textContent = conn.deviceMAC;
    ui.mac.value = conn.deviceMAC;
    setStatus("Connecté", "ok");
    setConnected(true);

    conn.events$.subscribe(handleEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Erreur : ${message}`);
    setStatus(`Échec : ${message}`, "err");
    setConnected(false);
    conn = null;
  }
});

ui.disconnect.addEventListener("click", async () => {
  await conn?.disconnect();
});

ui.reqFacelets.addEventListener("click", () => {
  void conn?.sendCubeCommand({ type: "REQUEST_FACELETS" });
});

ui.reqReset.addEventListener("click", async () => {
  // Indique au cube que son état physique actuel est l'état résolu.
  await conn?.sendCubeCommand({ type: "REQUEST_RESET" });
  await conn?.sendCubeCommand({ type: "REQUEST_FACELETS" });
  log("État résolu redéfini.");
});
