import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import type {
  LocalSale,
  LocalSaleItem,
  LocalCustomer,
  LocalProduct,
  LocalSupplierBill,
} from '../database';

// Formato de moneda estándar para Excel
const CURRENCY_FORMAT = '"$"#,##0';

/**
 * Comparte o descarga el archivo Excel (.xlsx) nativo
 */
export async function shareOrDownloadXlsx(
  filename: string,
  wb: XLSX.WorkBook
): Promise<void> {
  const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;

  if (Platform.OS === 'web') {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', safeFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const fileUri = `${dir}${safeFilename}`;

  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: `Compartir Reporte Excel: ${safeFilename}`,
      UTI: 'com.microsoft.excel.xlsx',
    });
  } else {
    throw new Error('La opción de compartir no está disponible en este dispositivo.');
  }
}

/**
 * Genera la hoja de cálculo de Ventas
 */
export function buildSalesWorksheet(
  sales: LocalSale[],
  items: LocalSaleItem[],
  customers: LocalCustomer[]
): XLSX.WorkSheet {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const itemsBySale = new Map<string, LocalSaleItem[]>();

  for (const item of items) {
    const list = itemsBySale.get(item.sale_id) || [];
    list.push(item);
    itemsBySale.set(item.sale_id, list);
  }

  let sumTotal = 0;
  let sumCash = 0;
  let sumDebt = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: any[][] = [
    ['🏪 EL CUADERNO DIGITAL - REPORTE DE VENTAS'],
    [`Generado el: ${dateStr} a las ${timeStr}`, '', '', '', '', '', '', '', '', ''],
    [],
    [
      'Venta #',
      'Fecha',
      'Hora',
      'Tipo de Pago',
      'Cliente / Vecino',
      'Total Venta ($)',
      'Efectivo ($)',
      'Fiado ($)',
      'Artículos Vendidos',
      'Notas',
    ],
  ];

  const headerRowIndex = 4; // Fila 4 (1-indexed)
  let currentRow = headerRowIndex;

  for (const s of sales) {
    currentRow++;
    sumTotal += s.total_amount || 0;
    sumCash += s.cash_amount || 0;
    sumDebt += s.debt_amount || 0;

    const cust = s.customer_id ? customerMap.get(s.customer_id) : undefined;
    const custName = cust
      ? `${cust.name}${cust.alias ? ` (${cust.alias})` : ''}`
      : 'Cliente Mostrador';

    const saleItems = itemsBySale.get(s.id) || [];
    const itemsSummary = saleItems
      .map((i) => `${i.quantity}x ${i.product_name} ($${i.subtotal})`)
      .join(' | ');

    const saleDate = new Date(s.created_at);

    rows.push([
      s.sale_number,
      saleDate.toLocaleDateString(),
      saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      s.payment_type === 'cash'
        ? 'Efectivo Contado'
        : s.payment_type === 'transfer'
        ? 'Nequi / Transferencia'
        : 'Fiado Cuaderno',
      custName,
      s.total_amount || 0,
      s.cash_amount || 0,
      s.debt_amount || 0,
      itemsSummary || s.notes || 'Venta directa',
      s.notes || '',
    ]);
  }

  // Fila de Totales
  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;
  rows.push([
    'TOTALES GENERALES',
    '',
    '',
    '',
    `${sales.length} ventas registradas`,
    sumTotal,
    sumCash,
    sumDebt,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Anchos de columna calculados
  ws['!cols'] = [
    { wch: 12 }, // Venta #
    { wch: 13 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 18 }, // Tipo de Pago
    { wch: 26 }, // Cliente
    { wch: 16 }, // Total Venta
    { wch: 16 }, // Efectivo
    { wch: 16 }, // Fiado
    { wch: 45 }, // Artículos
    { wch: 25 }, // Notas
  ];

  // Aplicar formato de moneda a las columnas F (Total), G (Efectivo), H (Fiado)
  const moneyCols = ['F', 'G', 'H'];
  for (let r = headerRowIndex + 1; r <= totalRowIndex; r++) {
    for (const col of moneyCols) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = CURRENCY_FORMAT;
      }
    }
  }

  return ws;
}

/**
 * Genera la hoja de cálculo de la Libreta de Fiados (Cartera)
 */
export function buildDebtorsWorksheet(customers: LocalCustomer[]): XLSX.WorkSheet {
  let totalDebt = 0;
  let debtorsCount = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const sorted = [...customers].sort(
    (a, b) => (b.current_debt || 0) - (a.current_debt || 0)
  );

  const rows: any[][] = [
    ['📒 EL CUADERNO DIGITAL - LIBRETA DE FIADOS (CARTERA)'],
    [`Generado el: ${dateStr} a las ${timeStr}`, '', '', '', '', '', ''],
    [],
    [
      'Nombre del Vecino',
      'Apodo / Referencia',
      'Teléfono',
      'Saldo Pendiente ($)',
      'Estado',
      'Último Movimiento',
      'Notas',
    ],
  ];

  const headerRowIndex = 4;
  let currentRow = headerRowIndex;

  for (const c of sorted) {
    currentRow++;
    const debt = c.current_debt || 0;
    totalDebt += debt;
    if (debt > 0) debtorsCount++;

    const lastUpdated = new Date(c.updated_at).toLocaleDateString();

    rows.push([
      c.name,
      c.alias || '',
      c.phone || '',
      debt,
      debt > 0 ? 'Con Deuda Pendiente ⚠️' : 'Al Día ✅',
      lastUpdated,
      c.notes || '',
    ]);
  }

  // Fila de Totales
  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;
  rows.push([
    'TOTAL CARTERA EN LA CALLE',
    '',
    `${debtorsCount} clientes con saldo`,
    totalDebt,
    '',
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 28 }, // Nombre
    { wch: 24 }, // Apodo
    { wch: 16 }, // Teléfono
    { wch: 20 }, // Saldo Pendiente
    { wch: 24 }, // Estado
    { wch: 18 }, // Último Movimiento
    { wch: 30 }, // Notas
  ];

  // Formato de moneda a columna D (Saldo Pendiente)
  for (let r = headerRowIndex + 1; r <= totalRowIndex; r++) {
    const cellRef = `D${r}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = CURRENCY_FORMAT;
    }
  }

  return ws;
}

/**
 * Genera la hoja de cálculo de Inventario y Existencias
 */
export function buildInventoryWorksheet(products: LocalProduct[]): XLSX.WorkSheet {
  let totalInvested = 0;
  let totalRetail = 0;
  let totalUnits = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: any[][] = [
    ['📦 EL CUADERNO DIGITAL - INVENTARIO Y VALORIZACIÓN DE MERCANCÍA'],
    [`Generado el: ${dateStr} a las ${timeStr}`, '', '', '', '', '', '', '', ''],
    [],
    [
      'Producto',
      'Stock Actual',
      'Precio Venta ($)',
      'Costo Proveedor ($)',
      'Alerta Mín.',
      'Total Invertido ($)',
      'Valor en Venta ($)',
      'Ganancia Estimada ($)',
      'Estado',
    ],
  ];

  const headerRowIndex = 4;
  let currentRow = headerRowIndex;

  for (const p of products) {
    currentRow++;
    const stock = p.current_stock || 0;
    const cost = p.cost_price || 0;
    const price = p.price || 0;
    const invested = stock * cost;
    const retail = stock * price;
    const profit = retail - invested;

    totalInvested += invested;
    totalRetail += retail;
    totalUnits += stock;

    const isLow = stock <= (p.min_stock_alert || 0);

    rows.push([
      p.name,
      stock,
      price,
      cost,
      p.min_stock_alert,
      invested,
      retail,
      profit,
      isLow ? '⚠️ AGOTÁNDOSE' : 'Normal',
    ]);
  }

  // Fila de Totales
  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;
  rows.push([
    'VALORIZACIÓN TOTAL DEL NEGOCIO',
    `${totalUnits} unidades en tienda`,
    '',
    '',
    '',
    totalInvested,
    totalRetail,
    totalRetail - totalInvested,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 32 }, // Producto
    { wch: 14 }, // Stock
    { wch: 16 }, // Precio Venta
    { wch: 16 }, // Costo Proveedor
    { wch: 14 }, // Alerta Mín
    { wch: 18 }, // Invertido
    { wch: 18 }, // Valor Venta
    { wch: 20 }, // Ganancia
    { wch: 16 }, // Estado
  ];

  // Columnas de dinero: C (Precio), D (Costo), F (Invertido), G (Valor Venta), H (Ganancia)
  const moneyCols = ['C', 'D', 'F', 'G', 'H'];
  for (let r = headerRowIndex + 1; r <= totalRowIndex; r++) {
    for (const col of moneyCols) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = CURRENCY_FORMAT;
      }
    }
  }

  return ws;
}

/**
 * Genera la hoja de Cierre de Caja y Finanzas
 */
export function buildCashSummaryWorksheet(params: {
  todayCashSales: number;
  todayTransferSales: number;
  todayCashPaymentsReceived: number;
  todayTransferPaymentsReceived: number;
  todayDebtSales: number;
  totalStreetDebt: number;
  todayOutflows: number;
  billsPaidToday: LocalSupplierBill[];
}): XLSX.WorkSheet {
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const {
    todayCashSales,
    todayTransferSales,
    todayCashPaymentsReceived,
    todayTransferPaymentsReceived,
    todayDebtSales,
    totalStreetDebt,
    todayOutflows,
    billsPaidToday,
  } = params;

  const theoreticalCashInDrawer =
    todayCashSales + todayCashPaymentsReceived - todayOutflows;
  const totalDigitalNequi = todayTransferSales + todayTransferPaymentsReceived;
  const totalBusinessRevenue =
    todayCashSales +
    todayCashPaymentsReceived +
    todayTransferSales +
    todayTransferPaymentsReceived;

  const rows: any[][] = [
    ['👑 EL CUADERNO DIGITAL - CIERRE DE CAJA Y ARQUEO DIARIO'],
    [`Fecha de Corte: ${dateStr} - ${timeStr}`, '', ''],
    [],
    ['--- 💵 SECCIÓN 1: EFECTIVO FÍSICO EN CAJÓN DE MOSTRADOR ---', '', ''],
    ['CONCEPTO', 'MONTO ($)', 'OBSERVACIONES'],
    [
      '💵 Ventas de Contado en Efectivo',
      todayCashSales,
      'Ingresos en billetes/monedas en mostrador',
    ],
    [
      '📥 Abonos de Fiados en Efectivo',
      todayCashPaymentsReceived,
      'Vecinos que abonaron en efectivo al cajón',
    ],
    [
      '💸 Salidas de Efectivo (Proveedores/Gastos)',
      -todayOutflows,
      'Pagos a repartidores (Bimbo, Coca-Cola) o gastos sacados del cajón',
    ],
    [
      '💰 TOTAL EFECTIVO QUE DEBE HABER EN EL CAJÓN',
      theoreticalCashInDrawer,
      'Total para contar y cuadrar físicamente',
    ],
    [],
    ['--- 📲 SECCIÓN 2: DINERO DIGITAL EN NEQUI / CUENTAS BANCARIAS ---', '', ''],
    ['CONCEPTO', 'MONTO ($)', 'OBSERVACIONES'],
    [
      '📲 Ventas Cobradas por Nequi / Transf.',
      todayTransferSales,
      'Entró directo a la cuenta Nequi/Bancolombia',
    ],
    [
      '📥 Abonos de Fiados por Nequi / Transf.',
      todayTransferPaymentsReceived,
      'Vecinos que transfirieron a tu número',
    ],
    [
      '📱 TOTAL DINERO EN NEQUI / BANCOS HOY',
      totalDigitalNequi,
      'Verificar saldo en la aplicación Nequi',
    ],
    [],
    ['--- 🌟 SECCIÓN 3: TOTAL GENERAL Y CARTERA ---', '', ''],
    ['CONCEPTO', 'MONTO ($)', 'OBSERVACIONES'],
    [
      '🌟 TOTAL RECAUDADO DEL NEGOCIO HOY',
      totalBusinessRevenue,
      'Efectivo Físico + Dinero Digital Nequi',
    ],
    [
      '📝 Ventas Fiadas Hoy (En la Calle)',
      todayDebtSales,
      'Mercancía entregada a crédito el día de hoy',
    ],
    [
      '📒 Cartera Total Acumulada por Cobrar',
      totalStreetDebt,
      'Saldo total adeudado por todos los vecinos',
    ],
  ];

  if (billsPaidToday.length > 0) {
    rows.push([]);
    rows.push(['--- 🚚 DETALLE DE PAGOS A DISTRIBUIDORES / SALIDAS DE HOY ---', '', '']);
    rows.push(['Proveedor / Concepto', 'Monto Pagado ($)', 'Nota']);
    for (const b of billsPaidToday) {
      rows.push([b.supplier_name, b.total_amount, b.notes || 'Pagado en efectivo de caja']);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 44 }, // Concepto
    { wch: 22 }, // Monto
    { wch: 50 }, // Observaciones
  ];

  // Formato de moneda para columna B
  for (let r = 5; r <= rows.length; r++) {
    const cellRef = `B${r}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = CURRENCY_FORMAT;
    }
  }

  return ws;
}

/**
 * Exporta el reporte de Ventas en formato Excel (.xlsx)
 */
export async function exportSalesToXlsx(
  sales: LocalSale[],
  items: LocalSaleItem[],
  customers: LocalCustomer[]
): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = buildSalesWorksheet(sales, items, customers);
  XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Reporte_Ventas_${todayStr}.xlsx`, wb);
}

/**
 * Exporta el reporte de Libreta de Fiados en formato Excel (.xlsx)
 */
export async function exportDebtorsToXlsx(customers: LocalCustomer[]): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = buildDebtorsWorksheet(customers);
  XLSX.utils.book_append_sheet(wb, ws, 'Libreta de Fiados');
  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Libreta_Fiados_${todayStr}.xlsx`, wb);
}

/**
 * Exporta el inventario y existencias en formato Excel (.xlsx)
 */
export async function exportInventoryToXlsx(products: LocalProduct[]): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = buildInventoryWorksheet(products);
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Inventario_Tienda_${todayStr}.xlsx`, wb);
}

/**
 * Exporta el LIBRO MAESTRO INTEGRAL DE LA TIENDA con 4 pestañas en un solo .xlsx
 */
export async function exportCompleteStoreWorkbookToXlsx(params: {
  sales: LocalSale[];
  items: LocalSaleItem[];
  customers: LocalCustomer[];
  products: LocalProduct[];
  todayCashSales: number;
  todayTransferSales: number;
  todayCashPaymentsReceived: number;
  todayTransferPaymentsReceived: number;
  todayDebtSales: number;
  totalStreetDebt: number;
  todayOutflows: number;
  billsPaidToday: LocalSupplierBill[];
}): Promise<void> {
  const wb = XLSX.utils.book_new();

  // Pestaña 1: Resumen de Caja y Arqueo (Separado en Efectivo y Nequi)
  const wsCash = buildCashSummaryWorksheet({
    todayCashSales: params.todayCashSales,
    todayTransferSales: params.todayTransferSales,
    todayCashPaymentsReceived: params.todayCashPaymentsReceived,
    todayTransferPaymentsReceived: params.todayTransferPaymentsReceived,
    todayDebtSales: params.todayDebtSales,
    totalStreetDebt: params.totalStreetDebt,
    todayOutflows: params.todayOutflows,
    billsPaidToday: params.billsPaidToday,
  });
  XLSX.utils.book_append_sheet(wb, wsCash, 'Cierre de Caja');

  // Pestaña 2: Libreta de Fiados
  const wsDebtors = buildDebtorsWorksheet(params.customers);
  XLSX.utils.book_append_sheet(wb, wsDebtors, 'Libreta de Fiados');

  // Pestaña 3: Detalle de Ventas
  const wsSales = buildSalesWorksheet(params.sales, params.items, params.customers);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas');

  // Pestaña 4: Inventario y Mercancía
  const wsInventory = buildInventoryWorksheet(params.products);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario');

  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Tienda_Reporte_Completo_${todayStr}.xlsx`, wb);
}
