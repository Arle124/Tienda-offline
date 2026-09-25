import { STORE_NAMES, StoreName } from './schema';
import type { IDatabaseDriver } from './adapter';

const DB_NAME = 'tienda_offline_db';
const DB_VERSION = 1;

export class IndexedDBDriver implements IDatabaseDriver {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        for (const storeName of STORE_NAMES) {
          if (!db.objectStoreNames.contains(storeName)) {
            if (storeName === 'sync_meta') {
              db.createObjectStore(storeName, { keyPath: 'key' });
            } else {
              db.createObjectStore(storeName, { keyPath: 'id' });
            }
          }
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onerror = () => {
        reject(request.error || new Error('Error al abrir IndexedDB en Web'));
      };
    });
  }

  private getDb(): IDBDatabase {
    if (!this.db) {
      throw new Error('IndexedDB no inicializada. Llama a init() primero.');
    }
    return this.db;
  }

  async getAll<T = any>(store: StoreName, predicate?: (item: T) => boolean): Promise<T[]> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => {
        const items = req.result as T[];
        resolve(predicate ? items.filter(predicate) : items);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getById<T = any>(store: StoreName, id: string): Promise<T | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async insert<T extends { id: string }>(store: StoreName, item: T): Promise<T> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).add(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async update<T extends { id: string }>(
    store: StoreName,
    id: string,
    updates: Partial<T>
  ): Promise<T> {
    const db = this.getDb();
    const existing = await this.getById<T>(store, id);
    if (!existing) {
      throw new Error(`Registro ${id} no encontrado en ${store}`);
    }

    const updated = { ...existing, ...updates, id };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(updated);
      req.onsuccess = () => resolve(updated);
      req.onerror = () => reject(req.error);
    });
  }

  async upsert<T extends { id: string }>(store: StoreName, item: T): Promise<T> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(item);
      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(store: StoreName, id: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(store: StoreName): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getMeta(key: string): Promise<string | null> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_meta', 'readonly');
      const req = tx.objectStore('sync_meta').get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async setMeta(key: string, value: string): Promise<void> {
    const db = this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_meta', 'readwrite');
      const req = tx.objectStore('sync_meta').put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async transaction<R>(fn: (driver: IDatabaseDriver) => Promise<R>): Promise<R> {
    // IndexedDB maneja transacciones por llamada; pasamos la instancia para completar la promesa
    return await fn(this);
  }
}

let instance: IndexedDBDriver | null = null;

export function getDatabaseDriver(): IDatabaseDriver {
  if (!instance) {
    instance = new IndexedDBDriver();
  }
  return instance;
}
