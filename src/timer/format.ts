/**
 * Formate un temps en ms : "9.87", "1:02.35".
 * Tronqué au centième (comme la WCA), pas arrondi.
 * Infinity = DNF, null = pas de valeur.
 */
export function formatTime(ms: number | null): string {
  if (ms == null) return "—";
  if (ms === Infinity) return "DNF";
  const cs = Math.floor(ms / 10);
  const minutes = Math.floor(cs / 6000);
  const seconds = Math.floor((cs % 6000) / 100);
  const hundredths = cs % 100;
  const sec = minutes > 0 ? String(seconds).padStart(2, "0") : String(seconds);
  return `${minutes > 0 ? `${minutes}:` : ""}${sec}.${String(hundredths).padStart(2, "0")}`;
}
