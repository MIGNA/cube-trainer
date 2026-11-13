import { versionLabel } from "../../app/version";
import type { View } from "../../app/router";
import {
  connectGanCube,
  connectKeyboardCube,
  cubeFacelets,
  cubeStatus,
  disconnectCube,
  markCubeSolved,
  resyncCube,
  isWebBluetoothAvailable,
  onCubeEvent,
  syncMismatch,
  type CubeStatus,
} from "../../ble/cube-service";
import { isSolved } from "../../cube/facelets";
import { getStorageInfo, requestPersistence } from "../../storage/persistence";
import { getSetting, setSetting } from "../../storage/settings";
import { h } from "../dom";

const MAX_MOVES_SHOWN = 30;

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "?";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
  return `${(bytes / 1024 ** 3).toFixed(1)} Go`;
}

function statusText(s: CubeStatus): string {
  switch (s.state) {
    case "disconnected":
      return "Non connecté";
    case "connecting":
      return "Connexion…";
    case "connected":
      return `Connecté : ${s.name}`;
    case "error":
      return `Échec : ${s.message}`;
  }
}

function cubeSection(): { el: HTMLElement; cleanup: () => void } {
  const status = h("p", { class: "status" });
  const macInput = h("input", {
    placeholder: "AB:12:CD:34:EF:56",
    autocomplete: "off",
    spellcheck: false,
  });
  void getSetting("lastCubeMac").then((mac) => {
    if (!macInput.value) macInput.value = mac;
  });

  const connectBtn = h("button", { onclick: () => void connectGanCube(macInput.value) }, "Connecter le cube");
  const keyboardBtn = h("button", { class: "secondary", onclick: () => void connectKeyboardCube() }, "Cube clavier (dev)");
  const disconnectBtn = h("button", { class: "secondary danger", onclick: () => void disconnectCube() }, "Déconnecter");
  const readBtn = h("button", { class: "secondary", onclick: () => void resyncCube() }, "Vérifier la synchro");
  const resetBtn = h("button", { class: "secondary", onclick: () => void markCubeSolved() }, "Marquer comme résolu");

  const info = {
    id: h("dd", {}, "—"),
    hardware: h("dd", {}, "—"),
    battery: h("dd", {}, "—"),
    solved: h("dd", {}, "—"),
    sync: h("dd", {}, "—"),
  };
  const movesEl = h("p", { class: "moves" }, "—");
  let moves: string[] = [];

  const unsubStatus = cubeStatus.subscribe((s) => {
    status.textContent = statusText(s);
    status.className = `status ${s.state === "connected" ? "ok" : s.state === "error" ? "err" : ""}`;
    const connected = s.state === "connected";
    connectBtn.disabled = s.state === "connecting" || !isWebBluetoothAvailable();
    keyboardBtn.disabled = s.state === "connecting";
    disconnectBtn.disabled = !connected;
    readBtn.disabled = !connected;
    resetBtn.disabled = !connected;
    info.id.textContent = connected ? s.id : "—";
    info.hardware.textContent = (connected && s.hardware) || "—";
    info.battery.textContent = connected && s.battery != null ? `${s.battery} %` : "—";
  });

  const unsubFacelets = cubeFacelets.subscribe((f) => {
    info.solved.textContent = f == null ? "—" : isSolved(f) ? "oui ✅" : "non";
  });

  const unsubSync = syncMismatch.subscribe((mismatch) => {
    if (cubeFacelets.get() == null) info.sync.textContent = "—";
    else info.sync.textContent = mismatch ? "⚠ écart détecté (corrigé avec l'état du cube)" : "OK ✅";
  });

  const unsubEvents = onCubeEvent((e) => {
    if (e.type === "move") {
      moves = [...moves, e.move].slice(-MAX_MOVES_SHOWN);
      movesEl.textContent = moves.join(" ");
    } else if (e.type === "facelets") {
      // Rafraîchit l'affichage même si la valeur de syncMismatch n'a pas changé.
      info.sync.textContent = syncMismatch.get() ? "⚠ écart détecté (corrigé avec l'état du cube)" : "OK ✅";
    }
  });

  const el = h(
    "section",
    { class: "card" },
    h("h2", {}, "Cube connecté"),
    !isWebBluetoothAvailable() &&
      h("p", { class: "status err" }, "Web Bluetooth indisponible : utilise Chrome (Android ou PC), en HTTPS ou sur localhost."),
    h("div", { class: "row" }, connectBtn, disconnectBtn),
    h("label", { class: "field" }, "Adresse MAC (seulement si la détection automatique échoue)", macInput),
    status,
    h(
      "dl",
      { class: "info" },
      h("dt", {}, "MAC"), info.id,
      h("dt", {}, "Matériel"), info.hardware,
      h("dt", {}, "Batterie"), info.battery,
      h("dt", {}, "Résolu"), info.solved,
      h("dt", {}, "Synchro"), info.sync,
    ),
    h("div", { class: "row" }, readBtn, resetBtn),
    h("h3", {}, "Derniers mouvements"),
    movesEl,
    h("div", { class: "row dev" }, keyboardBtn),
  );

  return {
    el,
    cleanup: () => {
      unsubStatus();
      unsubFacelets();
      unsubSync();
      unsubEvents();
    },
  };
}

function timerSection(): HTMLElement {
  const inspection = h("input", { type: "checkbox" });
  void getSetting("inspectionEnabled").then((v) => (inspection.checked = v));
  inspection.addEventListener("change", () => void setSetting("inspectionEnabled", inspection.checked));

  return h(
    "section",
    { class: "card" },
    h("h2", {}, "Chrono"),
    h(
      "label",
      { class: "toggle" },
      inspection,
      h("span", {}, "Inspection de 15 s (WCA)", h("small", { class: "muted" }, "+2 au-delà de 15 s, DNF au-delà de 17 s")),
    ),
  );
}

function dataSection(): HTMLElement {
  const persisted = h("dd", {}, "…");
  const usage = h("dd", {}, "…");
  const persistBtn = h("button", { class: "secondary" }, "Protéger mes données");

  async function refresh(): Promise<void> {
    const info = await getStorageInfo();
    persisted.textContent = info.persisted ? "oui ✅" : "non (Chrome peut les effacer si l'espace manque)";
    usage.textContent = `${formatBytes(info.usageBytes)} / ${formatBytes(info.quotaBytes)}`;
    persistBtn.hidden = info.persisted;
  }

  persistBtn.addEventListener("click", async () => {
    await requestPersistence();
    await refresh();
  });
  void refresh();

  return h(
    "section",
    { class: "card" },
    h("h2", {}, "Données"),
    h("p", { class: "muted" }, "Tout est stocké uniquement sur cet appareil."),
    h("dl", { class: "info" }, h("dt", {}, "Protégées"), persisted, h("dt", {}, "Espace utilisé"), usage),
    persistBtn,
  );
}

export const settingsView: View = {
  title: "Réglages",
  mount(container) {
    const cube = cubeSection();
    container.append(
      h("h1", {}, "Réglages"),
      timerSection(),
      cube.el,
      dataSection(),
      h("p", { class: "muted version" }, `Cube Trainer ${versionLabel()}`),
    );
    return cube.cleanup;
  },
};
