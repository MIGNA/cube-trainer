// Sans serveur, les données ne vivent que dans le navigateur.
// On demande donc à Chrome de ne pas les effacer en cas de manque d'espace.

export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export interface StorageInfo {
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const estimate = await navigator.storage?.estimate?.();
  return {
    persisted,
    usageBytes: estimate?.usage ?? null,
    quotaBytes: estimate?.quota ?? null,
  };
}
