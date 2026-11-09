// Mini état réactif : une valeur + des abonnés notifiés à chaque changement.
// Suffisant pour remplacer un framework sur une appli de cette taille.

export type Listener<T> = (value: T) => void;

export interface Signal<T> {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  /** Appelle le listener tout de suite, puis à chaque changement. Renvoie la fonction de désabonnement. */
  subscribe(listener: Listener<T>): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of listeners) l(value);
    },
    update(fn) {
      this.set(fn(value));
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(value);
      return () => listeners.delete(listener);
    },
  };
}
