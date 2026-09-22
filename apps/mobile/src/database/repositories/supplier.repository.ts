import { getDatabaseDriver } from '../connection';
import type { LocalSupplierBill, UserRole } from '../types';
import { generateUUID } from '../../utils/uuid';

export interface CreateSupplierBillParams {
  supplierName: string;
  totalAmount: number;
  dueDate?: string;
  photoUri?: string;
  isPaid?: boolean;
  notes?: string;
  createdBy?: UserRole;
  deviceId?: string;
}

export class SupplierRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async getAll(includeDeleted = false): Promise<LocalSupplierBill[]> {
    return await this.driver.getAll<LocalSupplierBill>(
      'supplier_bills',
      (b) => (includeDeleted ? true : !b.is_deleted)
    );
  }

  async getPendingBills(): Promise<LocalSupplierBill[]> {
    const bills = await this.driver.getAll<LocalSupplierBill>(
      'supplier_bills',
      (b) => !b.is_deleted && !b.is_paid
    );
    return bills.sort((a, b) =>
      (a.due_date || '').localeCompare(b.due_date || '')
    );
  }

  async createBill(params: CreateSupplierBillParams): Promise<LocalSupplierBill> {
    const now = new Date().toISOString();
    const bill: LocalSupplierBill = {
      id: generateUUID(),
      supplier_name: params.supplierName.trim(),
      total_amount: Number(params.totalAmount),
      due_date: params.dueDate || undefined,
      photo_uri: params.photoUri || undefined,
      is_paid: Boolean(params.isPaid),
      notes: params.notes?.trim() || undefined,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending_insert',
      created_by: params.createdBy,
      device_id: params.deviceId,
    };
    return await this.driver.insert<LocalSupplierBill>('supplier_bills', bill);
  }

  async markAsPaid(id: string): Promise<LocalSupplierBill> {
    const now = new Date().toISOString();
    return await this.driver.update<LocalSupplierBill>('supplier_bills', id, {
      is_paid: true,
      updated_at: now,
      sync_status: 'pending_update',
    });
  }

  async getTodayPaidOutflows(): Promise<{
    totalPaidToday: number;
    billsPaidToday: LocalSupplierBill[];
  }> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const bills = await this.driver.getAll<LocalSupplierBill>(
      'supplier_bills',
      (b) =>
        !b.is_deleted &&
        b.is_paid &&
        (b.updated_at.startsWith(todayStr) || b.created_at.startsWith(todayStr))
    );
    const totalPaidToday = bills.reduce(
      (sum, b) => sum + (b.total_amount || 0),
      0
    );
    return { totalPaidToday, billsPaidToday: bills };
  }

  async getPendingSync(): Promise<LocalSupplierBill[]> {
    return await this.driver.getAll<LocalSupplierBill>(
      'supplier_bills',
      (b) => b.sync_status !== 'synced'
    );
  }

  async markSynced(ids: string[]): Promise<void> {
    const idSet = new Set(ids);
    const pending = await this.getPendingSync();
    for (const b of pending) {
      if (idSet.has(b.id)) {
        await this.driver.update<LocalSupplierBill>('supplier_bills', b.id, {
          sync_status: 'synced',
        });
      }
    }
  }
}

export const supplierRepository = new SupplierRepository();
