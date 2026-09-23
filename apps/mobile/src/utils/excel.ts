import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx-js-style';
import type {
  LocalSale,
  LocalSaleItem,
  LocalCustomer,
  LocalProduct,
  LocalSupplierBill,
} from '../database';

// Formato de moneda estándar para Excel
const CURRENCY_FORMAT = '"$"#,##0';

// Paleta de bordes suaves y profesionales (evita saturar la vista)
const THIN_BORDER = {
  top: { style: 'thin', color: { rgb: 'E2E8F0' } },
  bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
  left: { style: 'thin', color: { rgb: 'E2E8F0' } },
  right: { style: 'thin', color: { rgb: 'E2E8F0' } },
};

const TOTAL_ROW_BORDER = {
  top: { style: 'thin', color: { rgb: '94A3B8' } },
  bottom: { style: 'double', color: { rgb: '64748B' } },
  left: { style: 'thin', color: { rgb: 'E2E8F0' } },
  right: { style: 'thin', color: { rgb: 'E2E8F0' } },
};

interface CellStyleProps {
  fill?: string;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
  sz?: number;
  align?: 'left' | 'center' | 'right';
  border?: any;
  numFmt?: string;
}

/**
 * Aplica estilos visuales refinados (colores pálidos, bordes limpios y fuentes legibles)
 */
function setCellStyle(ws: XLSX.WorkSheet, cellRef: string, props: CellStyleProps): void {
  if (!ws[cellRef]) return;

  const s: any = {
    font: {
      name: 'Segoe UI',
      sz: props.sz || 9.5,
      bold: Boolean(props.bold),
      italic: Boolean(props.italic),
      color: { rgb: props.fontColor || '1E293B' },
    },
    alignment: {
      horizontal: props.align || 'left',
      vertical: 'center',
    },
  };

  if (props.border !== false) {
    s.border = props.border || THIN_BORDER;
  }

  if (props.fill) {
    s.fill = {
      fgColor: { rgb: props.fill },
      patternType: 'solid',
    };
  }

  if (props.numFmt) {
    ws[cellRef].z = props.numFmt;
    s.numFmt = props.numFmt;
  }

  ws[cellRef].s = s;
}

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
    throw new Error('La opcion de compartir no esta disponible en este dispositivo.');
  }
}

/**
 * Genera la hoja estructurada de Ventas con paleta suave menta/salvia y autofiltros
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
    ['MI CUADERNO DIGITAL - REPORTE DETALLADO DE VENTAS'],
    [`Generado el: ${dateStr} a las ${timeStr} | Total Registros: ${sales.length} transacciones | Moneda: COP ($)`],
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
      'Credito Otorgado ($)',
      'Cant. Articulos',
      'Detalle de Articulos Vendidos',
      'Notas / Observaciones',
    ],
  ];

  const headerRowIndex = 4; // 1-indexed
  let currentRow = headerRowIndex;

  if (sales.length === 0) {
    currentRow++;
    rows.push([1, '-', dateStr, timeStr, 'Sin ventas', 'Sin clientes', 0, 0, 0, 0, 0, 'Sin articulos', 'Sin notas']);
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
          ? 'Efectivo Contado'
          : isTransfer
          ? 'Nequi / Transferencia'
          : 'Credito Libreta',
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

  // Fila de separador y Totales
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
    `${sales.length} ventas registradas`,
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
    { wch: 6 },  // A: N°
    { wch: 10 }, // B: Venta #
    { wch: 13 }, // C: Fecha
    { wch: 10 }, // D: Hora
    { wch: 23 }, // E: Medio de Pago
    { wch: 27 }, // F: Cliente / Cuenta
    { wch: 17 }, // G: Total Venta ($)
    { wch: 19 }, // H: Efectivo Recibido ($)
    { wch: 19 }, // I: Nequi / Digital ($)
    { wch: 19 }, // J: Credito Otorgado ($)
    { wch: 15 }, // K: Cant. Articulos
    { wch: 45 }, // L: Detalle de Articulos
    { wch: 25 }, // M: Notas
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }, // Titulo A1:M1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } }, // Subtitulo A2:M2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 4 } }, // Totales etiqueta A:E
  ];

  ws['!autofilter'] = { ref: `A4:M${lastDataRow}` };

  // --- ESTILIZACION VISUAL SUAVE (PASTEL SAGE / MENTA) ---
  // Titulo y subtitulo
  setCellStyle(ws, 'A1', {
    sz: 12,
    bold: true,
    fontColor: '0F172A',
    fill: 'F1F5F9',
    border: false,
  });
  setCellStyle(ws, 'A2', {
    sz: 9,
    italic: true,
    fontColor: '64748B',
    border: false,
  });

  const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];

  // Encabezados (Fila 4) - Verde menta suave
  const headerBorder = {
    top: { style: 'thin', color: { rgb: 'BBF7D0' } },
    bottom: { style: 'medium', color: { rgb: '86EFAC' } },
    left: { style: 'thin', color: { rgb: 'BBF7D0' } },
    right: { style: 'thin', color: { rgb: 'BBF7D0' } },
  };

  for (const col of columns) {
    const isNum = ['G', 'H', 'I', 'J', 'K'].includes(col);
    const isCenter = ['A', 'B', 'C', 'D', 'E'].includes(col);
    setCellStyle(ws, `${col}4`, {
      sz: 10,
      bold: true,
      fontColor: '14532D',
      fill: 'DCFCE7', // Menta palido
      align: isNum ? 'right' : isCenter ? 'center' : 'left',
      border: headerBorder,
    });
  }

  // Filas de datos (Zebra striping + badges de medios de pago)
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const isEven = (r - headerRowIndex) % 2 === 0;
    const baseRowFill = isEven ? 'F8FAFC' : 'FFFFFF'; // Alternancia blanca / gris perla sutil

    for (const col of columns) {
      const cellRef = `${col}${r}`;
      if (!ws[cellRef]) continue;

      const isMoney = ['G', 'H', 'I', 'J'].includes(col);
      const isQty = col === 'K';
      const isCenter = ['A', 'B', 'C', 'D'].includes(col);

      let cellFill = baseRowFill;
      let fontColor = '1E293B';
      let bold = false;

      // Color suave segun medio de pago en columna E
      if (col === 'E') {
        const val = String(ws[cellRef].v || '');
        if (val.includes('Efectivo')) {
          cellFill = 'F0FDF4'; // Verde palido
          fontColor = '166534';
        } else if (val.includes('Nequi')) {
          cellFill = 'EFF6FF'; // Azul cielo palido
          fontColor = '1E40AF';
        } else if (val.includes('Credito')) {
          cellFill = 'FFFBEB'; // Ambar crema palido
          fontColor = '92400E';
        }
      }

      setCellStyle(ws, cellRef, {
        fill: cellFill,
        fontColor,
        bold,
        align: isMoney || isQty ? 'right' : isCenter || col === 'E' ? 'center' : 'left',
        numFmt: isMoney ? CURRENCY_FORMAT : undefined,
      });
    }
  }

  // Fila de Totales
  for (const col of columns) {
    const cellRef = `${col}${totalRowIndex}`;
    const isMoney = ['G', 'H', 'I', 'J'].includes(col);
    const isQty = col === 'K';

    setCellStyle(ws, cellRef, {
      sz: 10,
      bold: true,
      fontColor: '0F172A',
      fill: 'F1F5F9', // Gris suave neutral
      border: TOTAL_ROW_BORDER,
      align: isMoney || isQty ? 'right' : 'left',
      numFmt: isMoney ? CURRENCY_FORMAT : undefined,
    });
  }

  return ws;
}

/**
 * Genera la hoja estructurada de Libreta de Créditos con paleta suave ámbar/crema y autofiltros
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
    ['MI CUADERNO DIGITAL - LIBRETA DE CREDITOS Y CARTERA'],
    [`Generado el: ${dateStr} a las ${timeStr} | Total Clientes: ${customers.length} | Moneda: COP ($)`],
    [],
    [
      'N°',
      'Nombre del Cliente',
      'Apodo / Referencia',
      'Telefono',
      'Saldo Pendiente ($)',
      'Estado de Cartera',
      'Ultimo Movimiento',
      'Notas / Observaciones',
    ],
  ];

  const headerRowIndex = 4;
  let currentRow = headerRowIndex;

  if (sorted.length === 0) {
    currentRow++;
    rows.push([1, 'Sin clientes registrados', '-', '-', 0, 'Al Dia ($0)', dateStr, '-']);
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
        debt > 0 ? 'Con Saldo Pendiente' : 'Al Dia ($0)',
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
    `${customers.length - debtorsCount} clientes al dia`,
    '',
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 6 },  // A: N°
    { wch: 28 }, // B: Nombre del Cliente
    { wch: 24 }, // C: Apodo / Referencia
    { wch: 16 }, // D: Telefono
    { wch: 20 }, // E: Saldo Pendiente ($)
    { wch: 24 }, // F: Estado de Cartera
    { wch: 18 }, // G: Ultimo Movimiento
    { wch: 30 }, // H: Notas
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }, // Titulo A1:H1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }, // Subtitulo A2:H2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 2 } }, // Totales etiqueta A:C
  ];

  ws['!autofilter'] = { ref: `A4:H${lastDataRow}` };

  // --- ESTILIZACION VISUAL SUAVE (PASTEL AMBAR / CREMA) ---
  setCellStyle(ws, 'A1', {
    sz: 12,
    bold: true,
    fontColor: '0F172A',
    fill: 'F1F5F9',
    border: false,
  });
  setCellStyle(ws, 'A2', {
    sz: 9,
    italic: true,
    fontColor: '64748B',
    border: false,
  });

  const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Encabezados (Fila 4) - Ambar calido suave
  const headerBorder = {
    top: { style: 'thin', color: { rgb: 'FDE68A' } },
    bottom: { style: 'medium', color: { rgb: 'FCD34D' } },
    left: { style: 'thin', color: { rgb: 'FDE68A' } },
    right: { style: 'thin', color: { rgb: 'FDE68A' } },
  };

  for (const col of columns) {
    const isMoney = col === 'E';
    const isCenter = ['A', 'D', 'F', 'G'].includes(col);
    setCellStyle(ws, `${col}4`, {
      sz: 10,
      bold: true,
      fontColor: '78350F',
      fill: 'FEF3C7', // Crema ambar suave
      align: isMoney ? 'right' : isCenter ? 'center' : 'left',
      border: headerBorder,
    });
  }

  // Filas de datos
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const isEven = (r - headerRowIndex) % 2 === 0;
    const baseRowFill = isEven ? 'F8FAFC' : 'FFFFFF';

    for (const col of columns) {
      const cellRef = `${col}${r}`;
      if (!ws[cellRef]) continue;

      const isMoney = col === 'E';
      const isCenter = ['A', 'D', 'G'].includes(col);

      let cellFill = baseRowFill;
      let fontColor = '1E293B';
      let bold = false;

      // Colores semanticos en la columna de Estado (F)
      if (col === 'F') {
        const val = String(ws[cellRef].v || '');
        if (val.includes('Pendiente')) {
          cellFill = 'FEF3C7'; // Ambar palido
          fontColor = '92400E';
          bold = true;
        } else {
          cellFill = 'F0FDF4'; // Verde palido
          fontColor = '166534';
        }
      }

      setCellStyle(ws, cellRef, {
        fill: cellFill,
        fontColor,
        bold,
        align: isMoney ? 'right' : isCenter || col === 'F' ? 'center' : 'left',
        numFmt: isMoney ? CURRENCY_FORMAT : undefined,
      });
    }
  }

  // Fila de Totales
  for (const col of columns) {
    const cellRef = `${col}${totalRowIndex}`;
    const isMoney = col === 'E';

    setCellStyle(ws, cellRef, {
      sz: 10,
      bold: true,
      fontColor: '0F172A',
      fill: 'F1F5F9',
      border: TOTAL_ROW_BORDER,
      align: isMoney ? 'right' : col === 'D' ? 'center' : 'left',
      numFmt: isMoney ? CURRENCY_FORMAT : undefined,
    });
  }

  return ws;
}

/**
 * Genera la hoja estructurada de Inventario con paleta suave azul cielo y autofiltros
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
    ['MI CUADERNO DIGITAL - CONTROL DE INVENTARIO Y VALORIZACION'],
    [`Generado el: ${dateStr} a las ${timeStr} | Catalogo: ${products.length} productos | Moneda: COP ($)`],
    [],
    [
      'N°',
      'Producto / Mercancia',
      'Stock Actual',
      'Alerta Minima',
      'Precio Venta ($)',
      'Costo Unitario ($)',
      'Inversion Total ($)',
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
    rows.push([1, 'Sin productos en catalogo', 0, 0, 0, 0, 0, 0, 0, '0.0%', 'Disponible']);
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
        isLow ? 'Agotandose (Stock Critico)' : 'Disponible',
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
    'VALORIZACION TOTAL DEL INVENTARIO',
    `${products.length} productos registrados`,
    totalUnits,
    `${lowStockCount} agotandose`,
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
    { wch: 6 },  // A: N°
    { wch: 32 }, // B: Producto / Mercancia
    { wch: 14 }, // C: Stock Actual
    { wch: 14 }, // D: Alerta Minima
    { wch: 16 }, // E: Precio Venta ($)
    { wch: 17 }, // F: Costo Unitario ($)
    { wch: 18 }, // G: Inversion Total ($)
    { wch: 18 }, // H: Valor en Venta ($)
    { wch: 20 }, // I: Ganancia Estimada ($)
    { wch: 14 }, // J: Margen (%)
    { wch: 26 }, // K: Estado de Existencias
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }, // Titulo A1:K1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }, // Subtitulo A2:K2
    { s: { r: totalRowIndex - 1, c: 0 }, e: { r: totalRowIndex - 1, c: 1 } }, // Totales etiqueta A:B
  ];

  ws['!autofilter'] = { ref: `A4:K${lastDataRow}` };

  // --- ESTILIZACION VISUAL SUAVE (PASTEL AZUL CIELO) ---
  setCellStyle(ws, 'A1', {
    sz: 12,
    bold: true,
    fontColor: '0F172A',
    fill: 'F1F5F9',
    border: false,
  });
  setCellStyle(ws, 'A2', {
    sz: 9,
    italic: true,
    fontColor: '64748B',
    border: false,
  });

  const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];

  // Encabezados (Fila 4) - Azul cielo suave
  const headerBorder = {
    top: { style: 'thin', color: { rgb: 'BAE6FD' } },
    bottom: { style: 'medium', color: { rgb: '7DD3FC' } },
    left: { style: 'thin', color: { rgb: 'BAE6FD' } },
    right: { style: 'thin', color: { rgb: 'BAE6FD' } },
  };

  for (const col of columns) {
    const isMoney = ['E', 'F', 'G', 'H', 'I'].includes(col);
    const isCenter = ['A', 'C', 'D', 'J', 'K'].includes(col);
    setCellStyle(ws, `${col}4`, {
      sz: 10,
      bold: true,
      fontColor: '075985',
      fill: 'E0F2FE', // Azul cielo palido
      align: isMoney ? 'right' : isCenter ? 'center' : 'left',
      border: headerBorder,
    });
  }

  // Filas de datos
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const isEven = (r - headerRowIndex) % 2 === 0;
    const baseRowFill = isEven ? 'F8FAFC' : 'FFFFFF';

    for (const col of columns) {
      const cellRef = `${col}${r}`;
      if (!ws[cellRef]) continue;

      const isMoney = ['E', 'F', 'G', 'H', 'I'].includes(col);
      const isQty = ['C', 'D'].includes(col);
      const isCenter = ['A', 'C', 'D', 'J'].includes(col);

      let cellFill = baseRowFill;
      let fontColor = '1E293B';
      let bold = false;

      // Color semantico suave para alertas de existencias (Columna K)
      if (col === 'K') {
        const val = String(ws[cellRef].v || '');
        if (val.includes('Critico') || val.includes('Agotandose')) {
          cellFill = 'FEE2E2'; // Rosa rojizo muy suave
          fontColor = '991B1B';
          bold = true;
        } else {
          cellFill = 'F0FDF4'; // Verde menta muy suave
          fontColor = '166534';
        }
      }

      setCellStyle(ws, cellRef, {
        fill: cellFill,
        fontColor,
        bold,
        align: isMoney || isQty ? 'right' : isCenter || col === 'K' ? 'center' : 'left',
        numFmt: isMoney ? CURRENCY_FORMAT : undefined,
      });
    }
  }

  // Fila de Totales
  for (const col of columns) {
    const cellRef = `${col}${totalRowIndex}`;
    const isMoney = ['G', 'H', 'I'].includes(col);
    const isQty = col === 'C';

    setCellStyle(ws, cellRef, {
      sz: 10,
      bold: true,
      fontColor: '0F172A',
      fill: 'F1F5F9',
      border: TOTAL_ROW_BORDER,
      align: isMoney || isQty ? 'right' : col === 'J' ? 'center' : 'left',
      numFmt: isMoney ? CURRENCY_FORMAT : undefined,
    });
  }

  return ws;
}

/**
 * Genera la hoja estructurada de Cierre de Caja con paleta suave lavanda y autofiltros
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
    ['MI CUADERNO DIGITAL - CIERRE DIARIO Y ARQUEO DE CAJA'],
    [`Fecha de Corte: ${dateStr} - ${timeStr} | Responsable: Administracion | Moneda: COP ($)`],
    [],
    [
      'Item',
      'Modulo Financiero',
      'Concepto Operativo / Movimiento',
      'Monto ($)',
      'Medio de Fondo',
      'Observaciones y Regla de Cuadre',
    ],
    // Seccion 1: Efectivo Fisico
    [
      1,
      'Efectivo Fisico en Caja',
      'Ventas de Contado en Mostrador',
      todayCashSales,
      'Monedas y Billetes',
      'Ingreso fisico directo a la caja registradora',
    ],
    [
      2,
      'Efectivo Fisico en Caja',
      'Abonos de Creditos Recibidos en Efectivo',
      todayCashPaymentsReceived,
      'Monedas y Billetes',
      'Dinero en efectivo entregado por clientes a cuenta',
    ],
    [
      3,
      'Efectivo Fisico en Caja',
      'Salidas de Caja Registradas (Gastos / Proveedores)',
      -todayOutflows,
      'Monedas y Billetes',
      'Salida fisica de dinero del cajon durante el turno',
    ],
    [
      4,
      'Efectivo Fisico en Caja',
      'SALDO TOTAL ESPERADO EN CAJON (ARQUEO FISICO)',
      theoreticalCashInDrawer,
      'Monedas y Billetes',
      'Monto exacto a contar fisicamente al cerrar turno',
    ],
    // Seccion 2: Dinero Digital
    [
      5,
      'Dinero Digital Bancario',
      'Ventas Cobradas por Nequi / Transferencia',
      todayTransferSales,
      'Cuenta Nequi / Bancaria',
      'Ingreso directamente a la cuenta digital del negocio',
    ],
    [
      6,
      'Dinero Digital Bancario',
      'Abonos de Creditos por Nequi / Transferencia',
      todayTransferPaymentsReceived,
      'Cuenta Nequi / Bancaria',
      'Clientes que transfirieron a la cuenta del negocio',
    ],
    [
      7,
      'Dinero Digital Bancario',
      'TOTAL DINERO DIGITAL (NEQUI / BANCOS)',
      totalDigitalNequi,
      'Cuenta Nequi / Bancaria',
      'Saldo total a verificar en la app Nequi o bancaria',
    ],
    // Seccion 3: Balance General y Cartera
    [
      8,
      'Balance Consolidado',
      'TOTAL RECAUDADO DEL NEGOCIO HOY',
      totalBusinessRevenue,
      'Efectivo Fisico + Dinero Digital',
      'Total de ingresos cobrados efectivamente en el dia',
    ],
    [
      9,
      'Balance Consolidado',
      'Ventas a Credito Otorgadas Hoy (En la Calle)',
      todayDebtSales,
      'Cartera por Cobrar',
      'Mercancia despachada a credito durante la jornada',
    ],
    [
      10,
      'Balance Consolidado',
      'Total Cartera Acumulada por Cobrar',
      totalStreetDebt,
      'Cartera Historica',
      'Saldo total pendiente adeudado por todos los clientes',
    ],
  ];

  // Si hubo salidas a repartidores / facturas pagadas hoy
  if (billsPaidToday && billsPaidToday.length > 0) {
    let billIndex = 10;
    for (const b of billsPaidToday) {
      billIndex++;
      rows.push([
        billIndex,
        'Salida a Proveedor',
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
    { wch: 6 },  // A: Item
    { wch: 27 }, // B: Modulo Financiero
    { wch: 48 }, // C: Concepto Operativo / Movimiento
    { wch: 20 }, // D: Monto ($)
    { wch: 28 }, // E: Medio de Fondo
    { wch: 54 }, // F: Observaciones y Regla de Cuadre
  ];

  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Titulo A1:F1
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // Subtitulo A2:F2
  ];

  ws['!autofilter'] = { ref: `A4:F${lastDataRow}` };

  // --- ESTILIZACION VISUAL SUAVE (PASTEL LAVANDA / PURPURA) ---
  setCellStyle(ws, 'A1', {
    sz: 12,
    bold: true,
    fontColor: '0F172A',
    fill: 'F1F5F9',
    border: false,
  });
  setCellStyle(ws, 'A2', {
    sz: 9,
    italic: true,
    fontColor: '64748B',
    border: false,
  });

  const columns = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Encabezados (Fila 4) - Lavanda palido
  const headerBorder = {
    top: { style: 'thin', color: { rgb: 'DDD6FE' } },
    bottom: { style: 'medium', color: { rgb: 'C4B5FD' } },
    left: { style: 'thin', color: { rgb: 'DDD6FE' } },
    right: { style: 'thin', color: { rgb: 'DDD6FE' } },
  };

  for (const col of columns) {
    const isMoney = col === 'D';
    const isCenter = col === 'A';
    setCellStyle(ws, `${col}4`, {
      sz: 10,
      bold: true,
      fontColor: '581C87',
      fill: 'EDE9FE', // Lavanda suave
      align: isMoney ? 'right' : isCenter ? 'center' : 'left',
      border: headerBorder,
    });
  }

  // Filas de datos
  for (let r = headerRowIndex + 1; r <= lastDataRow; r++) {
    const isEven = (r - headerRowIndex) % 2 === 0;
    const baseRowFill = isEven ? 'F8FAFC' : 'FFFFFF';
    const conceptCell = ws[`C${r}`]?.v ? String(ws[`C${r}`].v) : '';

    // Deteccion de filas clave para destacar con pasteles suaves
    const isDrawerBalance = conceptCell.includes('SALDO TOTAL ESPERADO EN CAJON');
    const isDigitalTotal = conceptCell.includes('TOTAL DINERO DIGITAL');
    const isGrandRevenue = conceptCell.includes('TOTAL RECAUDADO DEL NEGOCIO');
    const isOutflow = conceptCell.includes('Salidas de Caja') || ws[`B${r}`]?.v === 'Salida a Proveedor';

    for (const col of columns) {
      const cellRef = `${col}${r}`;
      if (!ws[cellRef]) continue;

      const isMoney = col === 'D';
      const isCenter = col === 'A';

      let cellFill = baseRowFill;
      let fontColor = '1E293B';
      let bold = false;

      if (isDrawerBalance) {
        cellFill = 'DCFCE7'; // Menta palido para arqueo en cajon
        fontColor = '14532D';
        bold = true;
      } else if (isDigitalTotal) {
        cellFill = 'DBEAFE'; // Azul palido para total Nequi
        fontColor = '1E40AF';
        bold = true;
      } else if (isGrandRevenue) {
        cellFill = 'FEF3C7'; // Ambar crema suave para total recaudado del negocio
        fontColor = '78350F';
        bold = true;
      } else if (isOutflow) {
        cellFill = 'FEE2E2'; // Rosa suave para salidas de dinero
        fontColor = '991B1B';
      }

      setCellStyle(ws, cellRef, {
        fill: cellFill,
        fontColor,
        bold,
        align: isMoney ? 'right' : isCenter ? 'center' : 'left',
        numFmt: isMoney ? CURRENCY_FORMAT : undefined,
      });
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
 * Exporta el reporte de Libreta de Creditos en formato Excel (.xlsx)
 */
export async function exportDebtorsToXlsx(customers: LocalCustomer[]): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = buildDebtorsWorksheet(customers);
  XLSX.utils.book_append_sheet(wb, ws, 'Libreta de Creditos');
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
 * Exporta el LIBRO MAESTRO INTEGRAL DE LA TIENDA con 4 pestañas estilizadas en un solo .xlsx
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

  // Pestaña 1: Resumen de Caja y Arqueo
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

  // Pestaña 2: Libreta de Creditos
  const wsDebtors = buildDebtorsWorksheet(params.customers);
  XLSX.utils.book_append_sheet(wb, wsDebtors, 'Libreta de Creditos');

  // Pestaña 3: Detalle de Ventas
  const wsSales = buildSalesWorksheet(params.sales, params.items, params.customers);
  XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas');

  // Pestaña 4: Inventario y Mercancia
  const wsInventory = buildInventoryWorksheet(params.products);
  XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario');

  const todayStr = new Date().toISOString().slice(0, 10);
  await shareOrDownloadXlsx(`Tienda_Reporte_Completo_${todayStr}.xlsx`, wb);
}
