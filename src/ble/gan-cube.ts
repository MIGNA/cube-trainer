import { connectGanCube, type GanCubeEvent } from "gan-web-bluetooth";
import { createEmitter, type CubeEvent, type SmartCube } from "./smart-cube";

/**
 * Fournit la MAC du cube (clé de déchiffrement du protocole GAN).
 * Appelé d'abord avec isFallback=false : renvoyer null laisse la bibliothèque
 * tenter la détection automatique. Puis avec isFallback=true en dernier recours.
 */
export type MacProvider = (isFallback: boolean) => Promise<string | null>;

function toCubeEvent(event: GanCubeEvent): CubeEvent | null {
  switch (event.type) {
    case "MOVE":
      return {
        type: "move",
        move: event.move,
        timestamp: event.localTimestamp ?? event.timestamp,
        cubeTimestamp: event.cubeTimestamp,
        serial: event.serial & 0xff,
      };
    case "FACELETS":
      return { type: "facelets", facelets: event.facelets, serial: event.serial & 0xff };
    case "BATTERY":
      return { type: "battery", level: event.batteryLevel };
    case "HARDWARE":
      return {
        type: "hardware",
        name: event.hardwareName,
        hardwareVersion: event.hardwareVersion,
        softwareVersion: event.softwareVersion,
      };
    case "DISCONNECT":
      return { type: "disconnect" };
    case "GYRO":
      return null; // inutilisé pour l'instant, et très fréquent
  }
}

export async function connectGan(macProvider: MacProvider): Promise<SmartCube> {
  const conn = await connectGanCube((_device, isFallbackCall) => macProvider(isFallbackCall ?? false));
  const emitter = createEmitter();

  conn.events$.subscribe((event) => {
    const mapped = toCubeEvent(event);
    if (mapped) emitter.emit(mapped);
  });

  return {
    kind: "gan",
    name: conn.deviceName,
    id: conn.deviceMAC,
    subscribe: emitter.subscribe,
    requestFacelets: () => conn.sendCubeCommand({ type: "REQUEST_FACELETS" }),
    requestBattery: () => conn.sendCubeCommand({ type: "REQUEST_BATTERY" }),
    requestHardware: () => conn.sendCubeCommand({ type: "REQUEST_HARDWARE" }),
    async markSolved() {
      await conn.sendCubeCommand({ type: "REQUEST_RESET" });
      await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    },
    disconnect: () => conn.disconnect(),
  };
}
