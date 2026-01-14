export type CacheStore<T> = {
  get: (key: string) => T | undefined;
  set: (key: string, value: T, ttlMs: number) => void;
  delete: (key: string) => void;
  clear: () => void;
};

export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};
