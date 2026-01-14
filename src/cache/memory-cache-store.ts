import type { CacheEntry, CacheStore } from "./cache-store.js";

export class MemoryCacheStore<T> implements CacheStore<T> {
  private entries = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      console.debug("[MemoryCacheStore:get] cache miss", key);
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      console.debug("[MemoryCacheStore:get] cache expired", key);
      this.entries.delete(key);
      return undefined;
    }

    console.debug("[MemoryCacheStore:get] cache hit", key);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.entries.set(key, { value, expiresAt });
    console.debug("[MemoryCacheStore:set] cache set", key, ttlMs);
  }

  delete(key: string): void {
    this.entries.delete(key);
    console.debug("[MemoryCacheStore:delete] cache delete", key);
  }

  clear(): void {
    this.entries.clear();
    console.debug("[MemoryCacheStore:clear] cache cleared");
  }
}

export function createMemoryCacheStore<T>(): CacheStore<T> {
  console.log("[memory-cache-store:createMemoryCacheStore] creating cache store");
  return new MemoryCacheStore<T>();
}
