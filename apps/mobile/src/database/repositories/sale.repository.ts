import { getDatabaseDriver } from '../connection';
import type {
  LocalSale,
  LocalSaleItem,
  LocalDebtRecord,
  LocalDebtPayment,
  PaymentType,
  UserRole,
} from '../types';
import { generateUUID } from '../../utils/uuid';
import { productRepository } from './product.repository';
import { customerRepository } from './customer.repository';

export interface TodaySalesSummary {
  totalSalesCount: number;
  totalCashSales: number;
  totalDebtSales: number;
  totalPaymentsReceived: number;
  totalRevenueToday: number;
  productsSold: Array<{
    productId?: string;
    productName: string;
    totalQuantity: number;
    totalSubtotal: number;
  }>;
}

export interface CreateSaleParams {
  customerId?: string;
  paymentType: PaymentType;
  totalAmount: number;
  cashAmount: number;
  debtAmount: number;
  notes?: string;
  createdBy?: UserRole;
  deviceId?: string;
  items: Array<{
    productId?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
}

export interface SaleWithDetails {
  sale: LocalSale;
  items: LocalSaleItem[];
  debt?: LocalDebtRecord;
}

export class SaleRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async createSale(params: CreateSaleParams): Promise<SaleWithDetails> {
    const now = new Date().toISOString();
    const saleId = generateUUID();

    return await this.driver.transaction(async () => {
      // 1. Obtener número de venta correlativo local
      const allSales = await this.driver.getAll<LocalSale>('sales');
      const maxSaleNumber = allSales.reduce(
        (max, s) => Math.max(max, s.sale_number || 0),
        0
      );
      const nextSaleNumber = maxSaleNumber + 1;

      // 2. Crear cabecera de venta
      const sale: LocalSale = {
        id: saleId,
        sale_number: nextSaleNumber,
        customer_id: params.customerId,
        payment_type: params.paymentType,
        total_amount: Number(params.totalAmount),
        cash_amount: Number(params.cashAmount),
        debt_amount: Number(params.debtAmount),
        notes: params.notes?.trim() || undefined,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        sync_status: 'pending_insert',
        created_by: params.createdBy,
        device_id: params.deviceId,
      };
      await this.driver.insert<LocalSale>('sales', sale);

      // 3. Crear ítems y descontar stock automáticamente
      const createdItems: LocalSaleItem[] = [];
      for (const item of params.items) {
        const saleItem: LocalSaleItem = {
          id: generateUUID(),
          sale_id: saleId,
          product_id: item.productId,
          product_name: item.productName.trim(),
          quantity: Number(item.quantity),
          unit_price: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
          created_at: now,
          updated_at: now,
          is_deleted: false,
          sync_status: 'pending_insert',
          created_by: params.createdBy,
          device_id: params.deviceId,
        };
        await this.driver.insert<LocalSaleItem>('sale_items', saleItem);
        createdItems.push(saleItem);

        // Descontar existencias si tiene producto asociado
        if (item.productId) {
          await productRepository.adjustStock(item.productId, -item.quantity);
        }
      }

      // 4. Si es a crédito o mixto, generar registro de deuda y actualizar cliente
      let createdDebt: LocalDebtRecord | undefined;
      if (
        (params.paymentType === 'debt' || params.paymentType === 'mixed') &&
        params.customerId &&
        params.debtAmount > 0
      ) {
        createdDebt = {
          id: generateUUID(),
          customer_id: params.customerId,
          sale_id: saleId,
          initial_amount: Number(params.debtAmount),
          current_balance: Number(params.debtAmount),
          status: 'pending',
          notes: `Fiado generado en venta #${nextSaleNumber}`,
          created_at: now,
          updated_at: now,
          is_deleted: false,
          sync_status: 'pending_insert',
          created_by: params.createdBy,
          device_id: params.deviceId,
        };
        await this.driver.insert<LocalDebtRecord>('debt_records', createdDebt);

        // Incrementar deuda del cliente
        await customerRepository.adjustDebt(params.customerId, params.debtAmount);
      }

      return {
        sale,
        items: createdItems,
        debt: createdDebt,
      };
    });
  }

  async getAll(limit = 100): Promise<LocalSale[]> {
    const sales = await this.driver.getAll<LocalSale>('sales', (s) => !s.is_deleted);
    return sales
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  async getSaleDetails(saleId: string): Promise<SaleWithDetails | null> {
    const sale = await this.driver.getById<LocalSale>('sales', saleId);
    if (!sale || sale.is_deleted) return null;

    const items = await this.driver.getAll<LocalSaleItem>(
      'sale_items',
      (i) => i.sale_id === saleId && !i.is_deleted
    );

    const debts = await this.driver.getAll<LocalDebtRecord>(
      'debt_records',
      (d) => d.sale_id === saleId && !d.is_deleted
    );

    return {
      sale,
      items,
      debt: debts[0] || undefined,
    };
  }

  async getTodaySummary(): Promise<TodaySalesSummary> {
    const todayStr = new Date().toISOString().slice(0, 10);
    const allSales = await this.driver.getAll<LocalSale>(
      'sales',
      (s) => !s.is_deleted && s.created_at.startsWith(todayStr)
    );
    const allPayments = await this.driver.getAll<LocalDebtPayment>(
      'debt_payments',
      (p) => !p.is_deleted && p.created_at.startsWith(todayStr)
    );
    const allItems = await this.driver.getAll<LocalSaleItem>(
      'sale_items',
      (i) => !i.is_deleted && i.created_at.startsWith(todayStr)
    );

    let totalCashSales = 0;
    let totalDebtSales = 0;
    for (const s of allSales) {
      totalCashSales += s.cash_amount || 0;
      totalDebtSales += s.debt_amount || 0;
    }

    let totalPaymentsReceived = 0;
    for (const p of allPayments) {
      totalPaymentsReceived += p.amount_paid || 0;
    }

    const productMap = new Map<
      string,
      { productId?: string; productName: string; totalQuantity: number; totalSubtotal: number }
    >();

    for (const item of allItems) {
      const key = item.product_name;
      const existing = productMap.get(key);
      if (existing) {
        existing.totalQuantity += item.quantity;
        existing.totalSubtotal += item.subtotal;
      } else {
        productMap.set(key, {
          productId: item.product_id,
          productName: item.product_name,
          totalQuantity: item.quantity,
          totalSubtotal: item.subtotal,
        });
      }
    }

    const productsSold = Array.from(productMap.values()).sort(
      (a, b) => b.totalQuantity - a.totalQuantity
    );

    return {
      totalSalesCount: allSales.length,
      totalCashSales,
      totalDebtSales,
      totalPaymentsReceived,
      totalRevenueToday: totalCashSales + totalPaymentsReceived,
      productsSold,
    };
  }

  async getAllSalesAndItems(): Promise<{ sales: LocalSale[]; items: LocalSaleItem[] }> {
    const sales = await this.driver.getAll<LocalSale>(
      'sales',
      (s) => !s.is_deleted
    );
    const items = await this.driver.getAll<LocalSaleItem>(
      'sale_items',
      (i) => !i.is_deleted
    );
    return {
      sales: sales.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
      items,
    };
  }

  async getPendingSync(): Promise<{ sales: LocalSale[]; items: LocalSaleItem[] }> {
    const sales = await this.driver.getAll<LocalSale>(
      'sales',
      (s) => s.sync_status !== 'synced'
    );
    const items = await this.driver.getAll<LocalSaleItem>(
      'sale_items',
      (i) => i.sync_status !== 'synced'
    );
    return { sales, items };
  }

  async markSynced(saleIds: string[], itemIds: string[]): Promise<void> {
    const saleSet = new Set(saleIds);
    const itemSet = new Set(itemIds);

    const pending = await this.getPendingSync();
    for (const s of pending.sales) {
      if (saleSet.has(s.id)) {
        await this.driver.update<LocalSale>('sales', s.id, {
          sync_status: 'synced',
        });
      }
    }
    for (const i of pending.items) {
      if (itemSet.has(i.id)) {
        await this.driver.update<LocalSaleItem>('sale_items', i.id, {
          sync_status: 'synced',
        });
      }
    }
  }
}

export const saleRepository = new SaleRepository();
