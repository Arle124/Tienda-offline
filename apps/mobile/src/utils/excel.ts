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
 * Genera la hoja de cálculo estructurada de Ventas con filtros nativos
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
  let sumTransfer = 0;
  let sumDebt = 0;
  let sumItemsCount = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: any[][] = [
    ['🏪 EL CUADERNO DIGITAL • REPORTE DETALLADO DE VENTAS'],
    [`Generado el: ${dateStr} a las ${timeStr} | Total Registros: ${sales.length} ventas | Moneda: COP ($)`],
    [],
    [
      'N°',
      'Venta #',
      'Fecha',
      'Hora',
      'Medio de Pago',
      'Cliente / Cuenta',
      'Total Venta ($)',
      'Efectivo Recibido ($)',
      'Nequi / Digital ($)',
      'Crédito Otorgado ($)',
      'Cant. Artículos',
      'Detalle de Artículos Vendidos',
      'Notas / Observaciones',
    ],
  ];

  const headerRowIndex = 4; // Fila 4 (1-indexed)
  let currentRow = headerRowIndex;

  if (sales.length === 0) {
    currentRow++;
    rows.push([1, '-', dateStr, timeStr, '-', 'Sin ventas registradas', 0, 0, 0, 0, 0, '-', '-']);
  } else {
    let itemIdx = 0;
    for (const s of sales) {
      itemIdx++;
      currentRow++;

      const isCash = s.payment_type === 'cash';
      const isTransfer = s.payment_type === 'transfer';
      const isDebt = s.payment_type === 'debt';

      const total = s.total_amount || 0;
      const cash = isCash ? (s.cash_amount || total) : (s.cash_amount || 0);
      const transfer = isTransfer ? total : 0;
      const debt = isDebt ? (s.debt_amount || total) : (s.debt_amount || 0);

      sumTotal += total;
      sumCash += cash;
      sumTransfer += transfer;
      sumDebt += debt;

      const cust = s.customer_id ? customerMap.get(s.customer_id) : undefined;
      const custName = cust
        ? `${cust.name}${cust.alias ? ` (${cust.alias})` : ''}`
        : 'Cliente Mostrador';

      const saleItems = itemsBySale.get(s.id) || [];
      const itemsCount = saleItems.reduce((acc, i) => acc + (i.quantity || 0), 0);
      sumItemsCount += itemsCount;

      const itemsSummary = saleItems
        .map((i) => `${i.quantity}x ${i.product_name} ($${i.subtotal?.toLocaleString() || 0})`)
        .join(' | ');

      const saleDate = new Date(s.created_at);

      rows.push([
        itemIdx,
        s.sale_number,
        saleDate.toLocaleDateString(),
        saleDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isCash
          ? '💵 Efectivo Contado'
          : isTransfer
          ? '📲 Nequi / Transf.'
          : '📒 Crédito Libreta',
        custName,
        total,
        cash,
        transfer,
        debt,
        itemsCount,
        itemsSummary || s.notes || 'Venta directa',
        s.notes || '',
      ]);
    }
  }

  const lastDataRow = currentRow;

  // Fila de separación y Fila de Totales
  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;

  rows.push([
    'RESUMEN GENERAL DE TOTALES',
    '',
    '',
    '',
    '',
    `${sales.length} ventas en total`,
    sumTotal,
    sumCash,
    sumTransfer,
    sumDebt,
    sumItemsCount,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 10 }, // Venta #
    { wch: 13 }, // Fecha
    { wch: 10 }, // Hora
    { wch: 22 }, // Medio de Pago
    { wch: 26 }, // Cliente
    { wch: 17 }, // Total Venta ($)
    { wch: 19 }, // Efectivo ($)
    { wch: 19 }, // Nequi ($)
    { wch: 19 }, // Crédito ($)
    { wch: 14 }, // Cant. Artículos
    { wch: 45 }, // Detalle Artículos
    { wch: 25 }, // Notas
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Título A1:M1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }, // Subtítulo A2:M2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 4 } }, // Totales etiqueta A:E
  ];

  ws['!autofilter'] = { ref: `A4:M${lastDataRow}` };

  // Formato de moneda para columnas G (Total), H (Efectivo), I (Nequi), J (Crédito)
  const moneyCols = ['G', 'H', 'I', 'J'];
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    for (const col of moneyCols) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = CURRENCY_FORMAT;
      }
    }
  }
  // Y a la fila de totales
  for (const col of moneyCols) {
    const cellRef = `${col}${totalRowIndex}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = CURRENCY_FORMAT;
    }
  }

  return ws;
}

/**
 * Genera la hoja de cálculo estructurada de la Libreta de Créditos (Cartera) con filtros
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
    ['📒 EL CUADERNO DIGITAL • LIBRETA DE CRÉDITOS Y CARTERA'],
    [`Generado el: ${dateStr} a las ${timeStr} | Total Clientes: ${customers.length} | Moneda: COP ($)`],
    [],
    [
      'N°',
      'Nombre del Cliente',
      'Apodo / Referencia',
      'Teléfono',
      'Saldo Pendiente ($)',
      'Estado de Cartera',
      'Último Movimiento',
      'Notas / Observaciones',
    ],
  ];

  const headerRowIndex = 4;
  let currentRow = headerRowIndex;

  if (sorted.length === 0) {
    currentRow++;
    rows.push([1, 'Sin clientes registrados', '-', '-', 0, '✅ AL DÍA ($0)', dateStr, '-']);
  } else {
    let idx = 0;
    for (const c of sorted) {
      idx++;
      currentRow++;
      const debt = c.current_debt || 0;
      totalDebt += debt;
      if (debt > 0) debtorsCount++;

      const lastUpdated = new Date(c.updated_at).toLocaleDateString();

      rows.push([
        idx,
        c.name,
        c.alias || '',
        c.phone || '',
        debt,
        debt > 0 ? '⚠️ CON DEUDA PENDIENTE' : '✅ AL DÍA ($0)',
        lastUpdated,
        c.notes || '',
      ]);
    }
  }

  const lastDataRow = currentRow;

  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;

  rows.push([
    'TOTAL CARTERA POR COBRAR',
    '',
    '',
    `${debtorsCount} clientes con saldo`,
    totalDebt,
    `${customers.length - debtorsCount} clientes al día`,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 28 }, // Nombre
    { wch: 24 }, // Apodo
    { wch: 16 }, // Teléfono
    { wch: 20 }, // Saldo Pendiente ($)
    { wch: 26 }, // Estado
    { wch: 18 }, // Último Movimiento
    { wch: 30 }, // Notas
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Título A1:H1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtítulo A2:H2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 2 } }, // Totales etiqueta A:C
  ];

  ws['!autofilter'] = { ref: `A4:H${lastDataRow}` };

  // Formato de moneda para columna E (Saldo Pendiente)
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const cellRef = `E${r}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = CURRENCY_FORMAT;
    }
  }
  // Y fila de totales
  const totalCellRef = `E${totalRowIndex}`;
  if (ws[totalCellRef] && typeof ws[totalCellRef].v === 'number') {
    ws[totalCellRef].z = CURRENCY_FORMAT;
  }

  return ws;
}

/**
 * Genera la hoja de cálculo estructurada de Inventario y Existencias con filtros
 */
export function buildInventoryWorksheet(products: LocalProduct[]): XLSX.WorkSheet {
  let totalInvested = 0;
  let totalRetail = 0;
  let totalUnits = 0;
  let lowStockCount = 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const rows: any[][] = [
    ['📦 EL CUADERNO DIGITAL • INVENTARIO Y VALORIZACIÓN DE MERCANCÍA'],
    [`Generado el: ${dateStr} a las ${timeStr} | Catálogo: ${products.length} productos | Moneda: COP ($)`],
    [],
    [
      'N°',
      'Producto / Mercancía',
      'Stock Actual',
      'Alerta Mínima',
      'Precio Venta ($)',
      'Costo Proveedor ($)',
      'Inversión Total ($)',
      'Valor en Venta ($)',
      'Ganancia Estimada ($)',
      'Margen (%)',
      'Estado de Existencias',
    ],
  ];

  const headerRowIndex = 4;
  let currentRow = headerRowIndex;

  if (products.length === 0) {
    currentRow++;
    rows.push([1, 'Sin productos en catálogo', 0, 0, 0, 0, 0, 0, 0, '0.0%', 'Normal']);
  } else {
    let idx = 0;
    for (const p of products) {
      idx++;
      currentRow++;
      const stock = p.current_stock || 0;
      const cost = p.cost_price || 0;
      const price = p.price || 0;
      const invested = stock * cost;
      const retail = stock * price;
      const profit = retail - invested;
      const margin = price > 0 ? `${(((price - cost) / price) * 100).toFixed(1)}%` : '0.0%';

      totalInvested += invested;
      totalRetail += retail;
      totalUnits += stock;

      const isLow = stock <= (p.min_stock_alert || 0);
      if (isLow) lowStockCount++;

      rows.push([
        idx,
        p.name,
        stock,
        p.min_stock_alert ?? 3,
        price,
        cost,
        invested,
        retail,
        profit,
        margin,
        isLow ? '⚠️ AGOTÁNDOSE' : '✅ DISPONIBLE',
      ]);
    }
  }

  const lastDataRow = currentRow;

  currentRow++;
  rows.push([]);
  currentRow++;
  const totalRowIndex = currentRow;

  const totalProfit = totalRetail - totalInvested;
  const overallMargin = totalRetail > 0 ? `${((totalProfit / totalRetail) * 100).toFixed(1)}%` : '0.0%';

  rows.push([
    'VALORIZACIÓN TOTAL DEL INVENTARIO',
    `${products.length} productos registrados`,
    totalUnits,
    `${lowStockCount} agotándose`,
    '',
    '',
    totalInvested,
    totalRetail,
    totalProfit,
    overallMargin,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // N°
    { wch: 32 }, // Producto
    { wch: 14 }, // Stock
    { wch: 14 }, // Alerta Mín
    { wch: 16 }, // Precio Venta
    { wch: 16 }, // Costo Proveedor
    { wch: 18 }, // Inversión Total
    { wch: 18 }, // Valor en Venta
    { wch: 20 }, // Ganancia Estimada
    { wch: 14 }, // Margen %
    { wch: 18 }, // Estado
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Título A1:K1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Subtítulo A2:K2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 1 } }, // Totales A:B
  ];

  ws['!autofilter'] = { ref: `A4:K${lastDataRow}` };

  // Formato de moneda para columnas E (Precio), F (Costo), G (Invertido), H (Valor Venta), I (Ganancia)
  const moneyCols = ['E', 'F', 'G', 'H', 'I'];
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    for (const col of moneyCols) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
        ws[cellRef].z = CURRENCY_FORMAT;
      }
    }
  }
  // Y totales
  for (const col of ['G', 'H', 'I']) {
    const cellRef = `${col}${totalRowIndex}`;
    if (ws[cellRef] && typeof ws[cellRef].v === 'number') {
      ws[cellRef].z = CURRENCY_FORMAT;
    }
  }

  return ws;
}

/**
 * Genera la hoja de cálculo estructurada de Cierre de Caja y Arqueo Diario con filtros
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
    ['💼 EL CUADERNO DIGITAL • CIERRE DIARIO Y ARQUEO DE CAJA'],
    [`Fecha de Corte: ${dateStr} - ${timeStr} | Responsable: Administración | Moneda: COP ($)`],
    [],
    [
      'Ítem',
      'Módulo Financiero',
      'Concepto Operativo / Movimiento',
      'Monto ($)',
      'Medio de Fondo',
      'Observaciones y Regla de Cuadre',
    ],
    // 💵 Sección 1: Efectivo Físico
    [
      1,
      '💵 Efectivo Físico en Caja',
      'Ventas de Contado en Mostrador',
      todayCashSales,
      'Monedas y Billetes',
      'Ingreso físico directo a la caja registradora',
    ],
    [
      2,
      '💵 Efectivo Físico en Caja',
      'Abonos de Créditos Recibidos en Efectivo',
      todayCashPaymentsReceived,
      'Monedas y Billetes',
      'Dinero en efectivo entregado por clientes a cuenta',
    ],
    [
      3,
      '💵 Efectivo Físico en Caja',
      'Salidas de Caja Registradas (Gastos / Proveedores)',
      -todayOutflows,
      'Monedas y Billetes',
      'Salida física de dinero del cajón durante el turno',
    ],
    [
      4,
      '💵 Efectivo Físico en Caja',
      '💰 SALDO TOTAL ESPERADO EN CAJÓN (ARQUEO FÍSICO)',
      theoreticalCashInDrawer,
      'Monedas y Billetes',
      'Monto exacto a contar físicamente al cerrar turno',
    ],
    // 📲 Sección 2: Dinero Digital
    [
      5,
      '📲 Dinero Digital Bancario',
      'Ventas Cobradas por Nequi / Transferencia',
      todayTransferSales,
      'Cuenta Nequi / Bancaria',
      'Ingresó directamente a la cuenta digital del negocio',
    ],
    [
      6,
      '📲 Dinero Digital Bancario',
      'Abonos de Créditos por Nequi / Transferencia',
      todayTransferPaymentsReceived,
      'Cuenta Nequi / Bancaria',
      'Clientes que transfirieron a la cuenta del negocio',
    ],
    [
      7,
      '📲 Dinero Digital Bancario',
      '📱 TOTAL DINERO DIGITAL RECAUDADO HOY',
      totalDigitalNequi,
      'Cuenta Nequi / Bancaria',
      'Saldo total a verificar en la app Nequi o bancaria',
    ],
    // 🌟 Sección 3: Balance General y Cartera
    [
      8,
      '🌟 Balance Consolidado',
      '🌟 TOTAL DINERO REAL RECAUDADO HOY',
      totalBusinessRevenue,
      'Efectivo Físico + Dinero Digital',
      'Total de ingresos cobrados efectivamente en el día',
    ],
    [
      9,
      '🌟 Balance Consolidado',
      'Ventas a Crédito Otorgadas Hoy (En la Calle)',
      todayDebtSales,
      'Cartera por Cobrar',
      'Mercancía despachada a crédito durante la jornada',
    ],
    [
      10,
      '🌟 Balance Consolidado',
      'Total Cartera Acumulada por Cobrar',
      totalStreetDebt,
      'Cartera Histórica',
      'Saldo total pendiente adeudado por todos los clientes',
    ],
  ];

  // Si hubo salidas o facturas de proveedores pagadas en el día, agregarlas como filas formales
  if (billsPaidToday && billsPaidToday.length > 0) {
    let billIndex = 10;
    for (const b of billsPaidToday) {
      billIndex++;
      rows.push([
        billIndex,
        '🚚 Salida a Proveedor',
        `Pago a Proveedor: ${b.supplier_name}`,
        -b.total_amount,
        'Efectivo de Mostrador',
        b.notes || 'Factura pagada a repartidor',
      ]);
    }
  }

  const headerRowIndex = 4;
  const lastDataRow = rows.length;

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // Ítem
    { wch: 28 }, // Módulo
    { wch: 48 }, // Concepto
    { wch: 20 }, // Monto ($)
    { wch: 28 }, // Medio de Fondo
    { wch: 54 }, // Observaciones
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Título A1:F1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtítulo A2:F2
  ];

  ws['!autofilter'] = { ref: `A4:F${lastDataRow}` };

  // Formato de moneda para columna D (Monto)
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const cellRef = `D${r}`;
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
 * Exporta el reporte de Libreta de Créditos en formato Excel (.xlsx)
 */
export async function exportDebtorsToXlsx(customers: LocalCustomer[]): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = buildDebtorsWorksheet(customers);
  XLSX.utils.book_append_sheet(wb, ws, 'Libreta de Créditos');
  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Libreta_Creditos_${todayStr}.xlsx`, wb);
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

  // Pestaña 2: Libreta de Créditos
  const wsDebtors = buildDebtorsWorksheet(params.customers);
  XLSX.utils.book_append_sheet(wb, wsDebtors, 'Libreta de Créditos');

  // Pestaña 3: Detalle de Ventas
  const wsSales = buildSalesWorksheet(params.sales, params.items, params.customers);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas');

  // Pestaña 4: Inventario y Mercancía
  const wsInventory = buildInventoryWorksheet(params.products);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario');

  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Tienda_Reporte_Completo_${todayStr}.xlsx`, wb);
}
