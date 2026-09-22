import type {
  BaseEntity,
  Customer,
  Product,
  Sale,
  SaleItem,
  DebtRecord,
  DebtPayment,
  SupplierBill,
  StoreSettings,
  SyncStatus,
  UserRole,
  PaymentType,
  DebtStatus,
  UUID,
} from '@tienda/shared';

export type LocalEntity<T extends BaseEntity> = T & {
  sync_status: SyncStatus;
};

export type LocalCustomer = LocalEntity<Customer>;
export type LocalProduct = LocalEntity<Product>;
export type LocalSale = LocalEntity<Sale>;
export type LocalSaleItem = LocalEntity<SaleItem>;
export type LocalDebtRecord = LocalEntity<DebtRecord>;
export type LocalDebtPayment = LocalEntity<DebtPayment>;
export type LocalSupplierBill = LocalEntity<SupplierBill>;
export type LocalStoreSettings = LocalEntity<StoreSettings>;

export type {
  Customer,
  Product,
  Sale,
  SaleItem,
  DebtRecord,
  DebtPayment,
  SupplierBill,
  StoreSettings,
  SyncStatus,
  UserRole,
  PaymentType,
  DebtStatus,
  UUID,
};
