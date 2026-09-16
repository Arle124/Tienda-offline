import type {
  Customer,
  Product,
  Sale,
  SaleItem,
  DebtRecord,
  DebtPayment,
  SupplierBill,
} from './types.js';

export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update';

export interface SyncPayloadGroup<T> {
  created: T[];
  updated: T[];
  deleted_ids: string[];
}

export interface SyncPushPayload {
  client_timestamp: string;
  customers: SyncPayloadGroup<Customer>;
  products: SyncPayloadGroup<Product>;
  sales: SyncPayloadGroup<Sale>;
  sale_items: SyncPayloadGroup<SaleItem>;
  debts: SyncPayloadGroup<DebtRecord>;
  payments: SyncPayloadGroup<DebtPayment>;
  supplier_bills: SyncPayloadGroup<SupplierBill>;
}

export interface SyncPullRequest {
  last_sync_timestamp: string;
}

export interface SyncPullResponse {
  server_timestamp: string;
  changes: {
    customers: Customer[];
    products: Product[];
    sales: Sale[];
    sale_items: SaleItem[];
    debts: DebtRecord[];
    payments: DebtPayment[];
    supplier_bills: SupplierBill[];
  };
}

export interface SyncResult {
  success: boolean;
  server_timestamp: string;
  processed_counts: Record<string, number>;
  pull_delta: SyncPullResponse['changes'];
}
