export type UUID = string;

export interface BaseEntity {
  id: UUID;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

export interface Customer extends BaseEntity {
  name: string;
  alias?: string;
  phone?: string;
  current_debt: number;
  notes?: string;
}

export interface Product extends BaseEntity {
  name: string;
  barcode?: string;
  price: number;
  cost_price?: number;
  current_stock: number;
  min_stock_alert: number;
  is_favorite: boolean;
  category?: string;
  image_uri?: string;
}

export type PaymentType = 'cash' | 'debt' | 'mixed';

export interface Sale extends BaseEntity {
  sale_number: number;
  customer_id?: UUID;
  payment_type: PaymentType;
  total_amount: number;
  cash_amount: number;
  debt_amount: number;
  notes?: string;
}

export interface SaleItem extends BaseEntity {
  sale_id: UUID;
  product_id?: UUID;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export type DebtStatus = 'pending' | 'partially_paid' | 'paid';

export interface DebtRecord extends BaseEntity {
  customer_id: UUID;
  sale_id?: UUID;
  initial_amount: number;
  current_balance: number;
  status: DebtStatus;
  notes?: string;
}

export interface DebtPayment extends BaseEntity {
  customer_id: UUID;
  debt_id?: UUID;
  amount_paid: number;
  notes?: string;
}

export interface SupplierBill extends BaseEntity {
  supplier_name: string;
  total_amount: number;
  due_date?: string;
  photo_uri?: string;
  is_paid: boolean;
  notes?: string;
}
