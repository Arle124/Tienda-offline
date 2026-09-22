import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { LocalSale, LocalSaleItem, LocalCustomer, LocalProduct } from '../database';

// Prefijo BOM para que Excel reconozca UTF-8 automáticamente con tildes y símbolos
const UTF8_BOM = '\uFEFF';

/**
 * Escapa un campo para CSV con delimitador punto y coma (estándar en Excel latinoamericano)
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  if (str.includes(';') || str.includes('\n') || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

/**
 * Comparte el archivo CSV en el celular (WhatsApp, Gmail, etc.) o lo descarga en Web
 */
export async function shareOrDownloadCsv(filename: string, content: string): Promise<void> {
  const fullContent = UTF8_BOM + content;

  if (Platform.OS === 'web') {
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const fileUri = `${dir}${filename}`;

  await FileSystem.writeAsStringAsync(fileUri, fullContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Compartir Reporte: ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    throw new Error('La opción de compartir no está disponible en este dispositivo.');
  }
}

/**
 * Genera el CSV del reporte de ventas con desglose de ítems
 */
export function generateSalesCsv(
  sales: LocalSale[],
  items: LocalSaleItem[],
  customers: LocalCustomer[]
): string {
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const itemsBySale = new Map<string, LocalSaleItem[]>();

  for (const item of items) {
    const list = itemsBySale.get(item.sale_id) || [];
    list.push(item);
    itemsBySale.set(item.sale_id, list);
  }

  const lines: string[] = [
    'EL CUADERNO DIGITAL - REPORTE DE VENTAS',
    `Fecha de Emisión:;${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    '',
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
    ]
      .map(escapeCsv)
      .join(';'),
  ];

  let sumTotal = 0;
  let sumCash = 0;
  let sumDebt = 0;

  for (const s of sales) {
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

    const dateObj = new Date(s.created_at);
    const dateStr = dateObj.toLocaleDateString();
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    lines.push(
      [
        s.sale_number,
        dateStr,
        timeStr,
        s.payment_type === 'cash' ? 'Efectivo' : 'Fiado',
        custName,
        s.total_amount,
        s.cash_amount,
        s.debt_amount,
        itemsSummary || s.notes || 'Venta directa',
        s.notes || '',
      ]
        .map(escapeCsv)
        .join(';')
    );
  }

  lines.push('');
  lines.push(
    ['TOTALES GENERALES', '', '', '', '', sumTotal, sumCash, sumDebt, '', '']
      .map(escapeCsv)
      .join(';')
  );

  return lines.join('\r\n');
}

/**
 * Genera el CSV de la libreta de fiados (cartera de clientes)
 */
export function generateDebtorsCsv(customers: LocalCustomer[]): string {
  const lines: string[] = [
    'EL CUADERNO DIGITAL - LIBRETA DE FIADOS (CARTERA)',
    `Fecha de Emisión:;${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    '',
    [
      'Nombre del Vecino',
      'Apodo / Referencia',
      'Teléfono',
      'Saldo Pendiente ($)',
      'Estado',
      'Notas',
      'Fecha Último Movimiento',
    ]
      .map(escapeCsv)
      .join(';'),
  ];

  let totalDebt = 0;
  let debtorsCount = 0;

  const sorted = [...customers].sort(
    (a, b) => (b.current_debt || 0) - (a.current_debt || 0)
  );

  for (const c of sorted) {
    const debt = c.current_debt || 0;
    totalDebt += debt;
    if (debt > 0) debtorsCount++;

    lines.push(
      [
        c.name,
        c.alias || '',
        c.phone || '',
        debt,
        debt > 0 ? 'Con Saldo Pendiente' : 'Al Día ✅',
        c.notes || '',
        new Date(c.updated_at).toLocaleDateString(),
      ]
        .map(escapeCsv)
        .join(';')
    );
  }

  lines.push('');
  lines.push(
    [
      'TOTAL CARTERA EN LA CALLE',
      `${debtorsCount} clientes con saldo`,
      '',
      totalDebt,
      '',
      '',
      '',
    ]
      .map(escapeCsv)
      .join(';')
  );

  return lines.join('\r\n');
}

/**
 * Genera el CSV de existencias y valorización de inventario
 */
export function generateInventoryCsv(products: LocalProduct[]): string {
  const lines: string[] = [
    'EL CUADERNO DIGITAL - INVENTARIO Y EXISTENCIAS',
    `Fecha de Emisión:;${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    '',
    [
      'Producto',
      'Stock Actual',
      'Precio Venta ($)',
      'Costo Proveedor ($)',
      'Alerta Mínima',
      'Total Invertido en Stock ($)',
      'Valor Comercial de Venta ($)',
      'Estado de Inventario',
      'Mostrador Rápido',
    ]
      .map(escapeCsv)
      .join(';'),
  ];

  let totalInvested = 0;
  let totalRetail = 0;
  let totalUnits = 0;

  for (const p of products) {
    const stock = p.current_stock || 0;
    const cost = p.cost_price || 0;
    const price = p.price || 0;
    const invested = stock * cost;
    const retail = stock * price;

    totalInvested += invested;
    totalRetail += retail;
    totalUnits += stock;

    const isLow = stock <= (p.min_stock_alert || 0);

    lines.push(
      [
        p.name,
        stock,
        price,
        cost,
        p.min_stock_alert,
        invested,
        retail,
        isLow ? '⚠️ AGOTÁNDOSE' : 'Normal',
        p.is_favorite ? 'Sí (Favorito)' : 'No',
      ]
        .map(escapeCsv)
        .join(';')
    );
  }

  lines.push('');
  lines.push(
    [
      'VALORIZACIÓN TOTAL DEL NEGOCIO',
      `${totalUnits} unidades en tienda`,
      '',
      '',
      '',
      totalInvested,
      totalRetail,
      '',
      '',
    ]
      .map(escapeCsv)
      .join(';')
  );

  return lines.join('\r\n');
}
