import * as SQLite from 'expo-sqlite';
import { SQLITE_SCHEMA, StoreName } from './schema';
import type { IDatabaseDriver } from './adapter';

const BOOLEAN_FIELDS = new Set(['is_deleted', 'is_favorite', 'is_paid', 'use_decimals', 'haptic_enabled']);

function toSqliteRow(item: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {};
  for (const [key, val] of Object.entries(item)) {
    if (typeof val === 'boolean') {
      row[key] = val ? 1 : 0;
    } else {
      row[key] = val ?? null;
    }
  }
  return row;
}

function fromSqliteRow<T>(row: Record<string, any>): T {
  const item: Record<string, any> = {};
  for (const [key, val] of Object.entries(row)) {
    if (BOOLEAN_FIELDS.has(key)) {
      item[key] = Boolean(val);
    } else {
      item[key] = val;
    }
  }
  return item as T;
}

export class SQLiteDriver implements IDatabaseDriver {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync('tienda.db');
      await this.db.execAsync(SQLITE_SCHEMA);
      try {
        await this.db.execAsync(
          'ALTER TABLE sales ADD COLUMN transfer_amount REAL NOT NULL DEFAULT 0.00;'
        );
      } catch {
        // Columna ya existe
      }
      try {
        await this.db.execAsync(
          "ALTER TABLE debt_payments ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';"
        );
      } catch {
        // Columna ya existe
      }
      try {
        await this.db.execAsync(
          "ALTER TABLE store_settings ADD COLUMN currency_symbol TEXT DEFAULT '$';"
        );
      } catch {
        // Columna ya existe
      }
      try {
        await this.db.execAsync(
          "ALTER TABLE store_settings ADD COLUMN use_decimals INTEGER DEFAULT 0;"
        );
      } catch {
        // Columna ya existe
      }
      try {
        await this.db.execAsync(
          "ALTER TABLE store_settings ADD COLUMN store_phone TEXT DEFAULT '';"
        );
      } catch {
        // Columna ya existe
      }
      try {
        await this.db.execAsync(
          "ALTER TABLE store_settings ADD COLUMN haptic_enabled INTEGER DEFAULT 1;"
        );
      } catch {
        // Columna ya existe
      }
    }
  }

  private getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('Base de datos no inicializada. Llama a init() primero.');
    }
    return this.db;
  }

  async getAll<T = any>(store: StoreName, predicate?: (item: T) => boolean): Promise<T[]> {
    const db = this.getDb();
    const rows = await db.getAllAsync<any>(`SELECT * FROM ${store}`);
    const items = rows.map((r) => fromSqliteRow<T>(r));
    return predicate ? items.filter(predicate) : items;
  }

  async getById<T = any>(store: StoreName, id: string): Promise<T | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<any>(`SELECT * FROM ${store} WHERE id = ?`, [id]);
    return row ? fromSqliteRow<T>(row) : null;
  }

  async insert<T extends { id: string }>(store: StoreName, item: T): Promise<T> {
    const db = this.getDb();
    const row = toSqliteRow(item);
    const keys = Object.keys(row);
    const placeholders = keys.map(() => '?').join(', ');
    const values = Object.values(row);

    await db.runAsync(
      `INSERT INTO ${store} (${keys.join(', ')}) VALUES (${placeholders})`,
      values
    );
    return item;
  }

  async update<T extends { id: string }>(
    store: StoreName,
    id: string,
    updates: Partial<T>
  ): Promise<T> {
    const db = this.getDb();
    const row = toSqliteRow(updates as Record<string, any>);
    delete row.id;

    const keys = Object.keys(row);
    if (keys.length === 0) {
      const existing = await this.getById<T>(store, id);
      if (!existing) throw new Error(`Registro ${id} no encontrado en ${store}`);
      return existing;
    }

    const setClause = keys.map((k) => `${k} = ?`).join(', ');
    const values = [...Object.values(row), id];

    await db.runAsync(`UPDATE ${store} SET ${setClause} WHERE id = ?`, values);
    const updated = await this.getById<T>(store, id);
    if (!updated) throw new Error(`Error recuperando registro ${id} tras update en ${store}`);
    return updated;
  }

  async upsert<T extends { id: string }>(store: StoreName, item: T): Promise<T> {
    const existing = await this.getById(store, item.id);
    if (existing) {
      return await this.update<T>(store, item.id, item);
    }
    return await this.insert<T>(store, item);
  }

  async delete(store: StoreName, id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(`DELETE FROM ${store} WHERE id = ?`, [id]);
  }

  async clearStore(store: StoreName): Promise<void> {
    const db = this.getDb();
    await db.runAsync(`DELETE FROM ${store}`);
  }

  async getMeta(key: string): Promise<string | null> {
    const db = this.getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_meta WHERE key = ?`,
      [key]
    );
    return row?.value ?? null;
  }

  async setMeta(key: string, value: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      `INSERT INTO sync_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, value]
    );
  }

  async transaction<R>(fn: (driver: IDatabaseDriver) => Promise<R>): Promise<R> {
    const db = this.getDb();
    let result!: R;
    await db.withTransactionAsync(async () => {
      result = await fn(this);
    });
    return result;
  }
}

let instance: SQLiteDriver | null = null;

export function getDatabaseDriver(): IDatabaseDriver {
  if (!instance) {
    instance = new SQLiteDriver();
  }
  return instance;
}
