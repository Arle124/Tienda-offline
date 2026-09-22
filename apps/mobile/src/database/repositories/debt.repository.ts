import { getDatabaseDriver } from '../connection';
import type {
  LocalDebtRecord,
  LocalDebtPayment,
  LocalSale,
  LocalSaleItem,
  UserRole,
} from '../types';
import { generateUUID } from '../../utils/uuid';
import { customerRepository } from './customer.repository';

export interface RecordPaymentParams {
  customerId: string;
  debtId?: string;
  amountPaid: number;
  paymentMethod?: 'cash' | 'transfer';
  notes?: string;
  createdBy?: UserRole;
  deviceId?: string;
}

export interface CustomerLedgerItem {
  id: string;
  type: 'debt' | 'payment';
  date: string;
  amount: number;
  paymentMethod?: 'cash' | 'transfer';
  notes?: string;
  saleNumber?: number;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export class DebtRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async getDebtsByCustomer(customerId: string): Promise<LocalDebtRecord[]> {
    return await this.driver.getAll<LocalDebtRecord>(
      'debt_records',
      (d) => d.customer_id === customerId && !d.is_deleted
    );
  }

  async getPaymentsByCustomer(customerId: string): Promise<LocalDebtPayment[]> {
    const payments = await this.driver.getAll<LocalDebtPayment>(
      'debt_payments',
      (p) => p.customer_id === customerId && !p.is_deleted
    );
    return payments.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  async getCustomerLedger(customerId: string): Promise<CustomerLedgerItem[]> {
    const allSales = await this.driver.getAll<LocalSale>(
      'sales',
      (s) => !s.is_deleted && s.customer_id === customerId
    );
    const allPayments = await this.getPaymentsByCustomer(customerId);
    const allItems = await this.driver.getAll<LocalSaleItem>(
      'sale_items',
      (i) => !i.is_deleted
    );

    const ledger: CustomerLedgerItem[] = [];

    for (const sale of allSales) {
      if (sale.debt_amount > 0) {
        const itemsForSale = allItems.filter((i) => i.sale_id === sale.id);
        ledger.push({
          id: sale.id,
          type: 'debt',
          date: sale.created_at,
          amount: sale.debt_amount,
          notes: sale.notes,
          saleNumber: sale.sale_number,
          items: itemsForSale.map((i) => ({
            productName: i.product_name,
            quantity: i.quantity,
            unitPrice: i.unit_price,
            subtotal: i.subtotal,
          })),
        });
      }
    }

    for (const p of allPayments) {
      ledger.push({
        id: p.id,
        type: 'payment',
        date: p.created_at,
        amount: p.amount_paid,
        paymentMethod: p.payment_method || 'cash',
        notes: p.notes,
      });
    }

    return ledger.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async recordPayment(params: RecordPaymentParams): Promise<LocalDebtPayment> {
    const now = new Date().toISOString();
    const paymentId = generateUUID();

    return await this.driver.transaction(async () => {
      // 1. Crear el abono
      const payment: LocalDebtPayment = {
        id: paymentId,
        customer_id: params.customerId,
        debt_id: params.debtId,
        amount_paid: Number(params.amountPaid),
        payment_method: params.paymentMethod || 'cash',
        notes: params.notes?.trim() || undefined,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        sync_status: 'pending_insert',
        created_by: params.createdBy,
        device_id: params.deviceId,
      };
      await this.driver.insert<LocalDebtPayment>('debt_payments', payment);

      // 2. Reducir la deuda global del cliente
      await customerRepository.adjustDebt(params.customerId, -params.amountPaid);

      // 3. Si se especificó una deuda concreta, actualizar su saldo y estado
      if (params.debtId) {
        const debt = await this.driver.getById<LocalDebtRecord>(
          'debt_records',
          params.debtId
        );
        if (debt) {
          const newBalance = Math.max(0, debt.current_balance - params.amountPaid);
          const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

          await this.driver.update<LocalDebtRecord>('debt_records', params.debtId, {
            current_balance: newBalance,
            status: newStatus,
            updated_at: now,
            sync_status: 'pending_update',
          });
        }
      }

      return payment;
    });
  }

  async getPendingSync(): Promise<{
    debts: LocalDebtRecord[];
    payments: LocalDebtPayment[];
  }> {
    const debts = await this.driver.getAll<LocalDebtRecord>(
      'debt_records',
      (d) => d.sync_status !== 'synced'
    );
    const payments = await this.driver.getAll<LocalDebtPayment>(
      'debt_payments',
      (p) => p.sync_status !== 'synced'
    );
    return { debts, payments };
  }

  async markSynced(debtIds: string[], paymentIds: string[]): Promise<void> {
    const debtSet = new Set(debtIds);
    const paymentSet = new Set(paymentIds);

    const pending = await this.getPendingSync();
    for (const d of pending.debts) {
      if (debtSet.has(d.id)) {
        await this.driver.update<LocalDebtRecord>('debt_records', d.id, {
          sync_status: 'synced',
        });
      }
    }
    for (const p of pending.payments) {
      if (paymentSet.has(p.id)) {
        await this.driver.update<LocalDebtPayment>('debt_payments', p.id, {
          sync_status: 'synced',
        });
      }
    }
  }
}

export const debtRepository = new DebtRepository();
