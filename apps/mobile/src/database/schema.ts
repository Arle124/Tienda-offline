export const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT,
    phone TEXT,
    current_debt REAL NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status);

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    barcode TEXT,
    price REAL NOT NULL DEFAULT 0.00,
    cost_price REAL DEFAULT 0.00,
    current_stock REAL NOT NULL DEFAULT 0.00,
    min_stock_alert REAL NOT NULL DEFAULT 3.00,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    category TEXT,
    image_uri TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sync_status ON products(sync_status);

CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    sale_number INTEGER,
    customer_id TEXT,
    payment_type TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.00,
    cash_amount REAL NOT NULL DEFAULT 0.00,
    transfer_amount REAL NOT NULL DEFAULT 0.00,
    debt_amount REAL NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_sales_updated_at ON sales(updated_at);
CREATE INDEX IF NOT EXISTS idx_sales_sync_status ON sales(sync_status);

CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT NOT NULL,
    product_id TEXT,
    product_name TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1.00,
    unit_price REAL NOT NULL DEFAULT 0.00,
    subtotal REAL NOT NULL DEFAULT 0.00,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sync_status ON sale_items(sync_status);

CREATE TABLE IF NOT EXISTS debt_records (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    sale_id TEXT,
    initial_amount REAL NOT NULL DEFAULT 0.00,
    current_balance REAL NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_debt_records_customer_id ON debt_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_records_sync_status ON debt_records(sync_status);

CREATE TABLE IF NOT EXISTS debt_payments (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    debt_id TEXT,
    amount_paid REAL NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'cash',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_debt_payments_customer_id ON debt_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_sync_status ON debt_payments(sync_status);

CREATE TABLE IF NOT EXISTS supplier_bills (
    id TEXT PRIMARY KEY,
    supplier_name TEXT NOT NULL,
    total_amount REAL NOT NULL DEFAULT 0.00,
    due_date TEXT,
    photo_uri TEXT,
    is_paid INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_supplier_bills_sync_status ON supplier_bills(sync_status);

CREATE TABLE IF NOT EXISTS store_settings (
    id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    owner_pin_hash TEXT NOT NULL,
    currency_symbol TEXT DEFAULT '$',
    use_decimals INTEGER DEFAULT 0,
    store_phone TEXT DEFAULT '',
    haptic_enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending_insert',
    created_by TEXT,
    device_id TEXT
);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`;

export const STORE_NAMES = [
  'customers',
  'products',
  'sales',
  'sale_items',
  'debt_records',
  'debt_payments',
  'supplier_bills',
  'store_settings',
  'sync_meta',
] as const;

export type StoreName = (typeof STORE_NAMES)[number];
