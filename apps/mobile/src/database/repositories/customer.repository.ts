import { getDatabaseDriver } from '../connection';
import type { LocalCustomer, LocalDebtRecord } from '../types';
import { generateUUID } from '../../utils/uuid';

export class CustomerRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async getAll(includeDeleted = false): Promise<LocalCustomer[]> {
    return await this.driver.getAll<LocalCustomer>('customers', (c) =>
      includeDeleted ? true : !c.is_deleted
    );
  }

  async getById(id: string): Promise<LocalCustomer | null> {
    const customer = await this.driver.getById<LocalCustomer>('customers', id);
    if (!customer || customer.is_deleted) return null;
    return customer;
  }

  async search(query: string): Promise<LocalCustomer[]> {
    const term = query.toLowerCase().trim();
    if (!term) return this.getAll();

    return await this.driver.getAll<LocalCustomer>('customers', (c) => {
      if (c.is_deleted) return false;
      return Boolean(
        c.name.toLowerCase().includes(term) ||
          (c.alias && c.alias.toLowerCase().includes(term)) ||
          (c.phone && c.phone.includes(term))
      );
    });
  }

  async save(
    data: Partial<LocalCustomer> & { name: string }
  ): Promise<LocalCustomer> {
    const now = new Date().toISOString();

    if (data.id) {
      const existing = await this.driver.getById<LocalCustomer>('customers', data.id);
      if (!existing) {
        throw new Error(`Cliente ${data.id} no encontrado`);
      }
      return await this.driver.update<LocalCustomer>('customers', data.id, {
        ...data,
        updated_at: now,
        sync_status: 'pending_update',
      });
    } else {
      const newCustomer: LocalCustomer = {
        id: generateUUID(),
        name: data.name.trim(),
        alias: data.alias?.trim() || undefined,
        phone: data.phone?.trim() || undefined,
        current_debt: data.current_debt ? Number(data.current_debt) : 0,
        notes: data.notes?.trim() || undefined,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        sync_status: 'pending_insert',
        created_by: data.created_by,
        device_id: data.device_id,
      };
      return await this.driver.insert<LocalCustomer>('customers', newCustomer);
    }
  }

  async adjustDebt(id: string, delta: number): Promise<void> {
    const customer = await this.driver.getById<LocalCustomer>('customers', id);
    if (!customer) throw new Error(`Cliente ${id} no encontrado`);

    const newDebt = Math.max(0, Number((customer.current_debt + delta).toFixed(2)));
    await this.driver.update<LocalCustomer>('customers', id, {
      current_debt: newDebt,
      updated_at: new Date().toISOString(),
      sync_status: 'pending_update',
    });
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date().toISOString();
    await this.driver.transaction(async () => {
      await this.driver.update<LocalCustomer>('customers', id, {
        is_deleted: true,
        updated_at: now,
        sync_status: 'pending_update',
      });

      // Archivar también cualquier deuda activa vinculada al cliente
      const activeDebts = await this.driver.getAll<LocalDebtRecord>(
        'debt_records',
        (d) => d.customer_id === id && !d.is_deleted
      );
      for (const debt of activeDebts) {
        await this.driver.update<LocalDebtRecord>('debt_records', debt.id, {
          is_deleted: true,
          updated_at: now,
          sync_status: 'pending_update',
        });
      }
    });
  }

  async hardDelete(id: string): Promise<void> {
    await this.driver.delete('customers', id);
  }

  async getPendingSync(): Promise<LocalCustomer[]> {
    return await this.driver.getAll<LocalCustomer>(
      'customers',
      (c) => c.sync_status !== 'synced'
    );
  }

  async markSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const pending = await this.getPendingSync();
    for (const c of pending) {
      if (idSet.has(c.id)) {
        await this.driver.update<LocalCustomer>('customers', c.id, {
          sync_status: 'synced',
        });
      }
    }
  }
}

export const customerRepository = new CustomerRepository();
