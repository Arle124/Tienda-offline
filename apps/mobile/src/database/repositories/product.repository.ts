import { getDatabaseDriver } from '../connection';
import type { LocalProduct } from '../types';
import { generateUUID } from '../../utils/uuid';

export class ProductRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async getAll(includeDeleted = false): Promise<LocalProduct[]> {
    return await this.driver.getAll<LocalProduct>('products', (p) =>
      includeDeleted ? true : !p.is_deleted
    );
  }

  async getFavorites(): Promise<LocalProduct[]> {
    return await this.driver.getAll<LocalProduct>(
      'products',
      (p) => !p.is_deleted && Boolean(p.is_favorite)
    );
  }

  async getById(id: string): Promise<LocalProduct | null> {
    const product = await this.driver.getById<LocalProduct>('products', id);
    if (!product || product.is_deleted) return null;
    return product;
  }

  async getByBarcode(barcode: string): Promise<LocalProduct | null> {
    const results = await this.driver.getAll<LocalProduct>(
      'products',
      (p) => !p.is_deleted && p.barcode === barcode
    );
    return results[0] || null;
  }

  async save(
    data: Partial<LocalProduct> & { name: string; price: number }
  ): Promise<LocalProduct> {
    const now = new Date().toISOString();

    if (data.id) {
      const existing = await this.driver.getById<LocalProduct>('products', data.id);
      if (!existing) {
        throw new Error(`Producto ${data.id} no encontrado`);
      }
      return await this.driver.update<LocalProduct>('products', data.id, {
        ...data,
        updated_at: now,
        sync_status: 'pending_update',
      });
    } else {
      const newProduct: LocalProduct = {
        id: generateUUID(),
        name: data.name.trim(),
        barcode: data.barcode?.trim() || undefined,
        price: Number(data.price),
        cost_price: data.cost_price ? Number(data.cost_price) : 0,
        current_stock: data.current_stock ? Number(data.current_stock) : 0,
        min_stock_alert: data.min_stock_alert ? Number(data.min_stock_alert) : 3,
        is_favorite: Boolean(data.is_favorite),
        category: data.category?.trim() || undefined,
        image_uri: data.image_uri || undefined,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        sync_status: 'pending_insert',
        created_by: data.created_by,
        device_id: data.device_id,
      };
      return await this.driver.insert<LocalProduct>('products', newProduct);
    }
  }

  async adjustStock(id: string, quantityDelta: number): Promise<void> {
    const product = await this.driver.getById<LocalProduct>('products', id);
    if (!product) throw new Error(`Producto ${id} no encontrado`);

    const newStock = Number((product.current_stock + quantityDelta).toFixed(2));
    await this.driver.update<LocalProduct>('products', id, {
      current_stock: newStock,
      updated_at: new Date().toISOString(),
      sync_status: 'pending_update',
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.driver.update<LocalProduct>('products', id, {
      is_deleted: true,
      updated_at: new Date().toISOString(),
      sync_status: 'pending_update',
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.driver.delete('products', id);
  }


  async getPendingSync(): Promise<LocalProduct[]> {
    return await this.driver.getAll<LocalProduct>(
      'products',
      (p) => p.sync_status !== 'synced'
    );
  }

  async markSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const pending = await this.getPendingSync();
    for (const p of pending) {
      if (idSet.has(p.id)) {
        await this.driver.update<LocalProduct>('products', p.id, {
          sync_status: 'synced',
        });
      }
    }
  }
}

export const productRepository = new ProductRepository();
