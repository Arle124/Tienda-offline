import type { StoreName } from './schema';

export interface IDatabaseDriver {
  init(): Promise<void>;
  getAll<T = any>(store: StoreName, predicate?: (item: T) => boolean): Promise<T[]>;
  getById<T = any>(store: StoreName, id: string): Promise<T | null>;
  insert<T extends { id: string }>(store: StoreName, item: T): Promise<T>;
  update<T extends { id: string }>(store: StoreName, id: string, updates: Partial<T>): Promise<T>;
  upsert<T extends { id: string }>(store: StoreName, item: T): Promise<T>;
  delete(store: StoreName, id: string): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  transaction<R>(fn: (driver: IDatabaseDriver) => Promise<R>): Promise<R>;
}
