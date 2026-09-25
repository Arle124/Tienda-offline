import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { getDatabaseDriver } from '../database/connection';
import type {
  LocalCustomer,
  LocalProduct,
  LocalSale,
  LocalSaleItem,
  LocalDebtRecord,
  LocalDebtPayment,
  LocalSupplierBill,
  LocalStoreSettings,
} from '../database/types';

export interface BackupEnvelope {
  schema_version: number;
  app_version: string;
  app_name: string;
  exported_at: string;
  counts: {
    customers: number;
    products: number;
    sales: number;
    sale_items: number;
    debt_records: number;
    debt_payments: number;
    supplier_bills: number;
    store_settings: number;
  };
  data: {
    customers: LocalCustomer[];
    products: LocalProduct[];
    sales: LocalSale[];
    sale_items: LocalSaleItem[];
    debt_records: LocalDebtRecord[];
    debt_payments: LocalDebtPayment[];
    supplier_bills: LocalSupplierBill[];
    store_settings: LocalStoreSettings[];
  };
}

export interface RestoreResult {
  success: boolean;
  message: string;
  counts: {
    customers: number;
    products: number;
    sales: number;
    debts: number;
    supplier_bills: number;
  };
}

export class BackupService {
  /**
   * Genera una copia de seguridad integral en formato JSON con todos los datos del negocio
   * y despliega el diálogo nativo para compartirla (Google Drive, WhatsApp, Descargas, etc.)
   */
  async exportBackup(): Promise<string> {
    const driver = getDatabaseDriver();

    // 1. Extraer todas las entidades de la base de datos local
    const [
      customers,
      products,
      sales,
      sale_items,
      debt_records,
      debt_payments,
      supplier_bills,
      store_settings,
    ] = await Promise.all([
      driver.getAll<LocalCustomer>('customers'),
      driver.getAll<LocalProduct>('products'),
      driver.getAll<LocalSale>('sales'),
      driver.getAll<LocalSaleItem>('sale_items'),
      driver.getAll<LocalDebtRecord>('debt_records'),
      driver.getAll<LocalDebtPayment>('debt_payments'),
      driver.getAll<LocalSupplierBill>('supplier_bills'),
      driver.getAll<LocalStoreSettings>('store_settings'),
    ]);

    const timestamp = new Date().toISOString();
    const dateFormatted = new Date().toISOString().slice(0, 10);
    const timeFormatted = new Date()
      .toTimeString()
      .slice(0, 5)
      .replace(':', '');
    const filename = `mi_cuaderno_backup_${dateFormatted}_${timeFormatted}.json`;

    // 2. Construir sobre estructurado
    const backupEnvelope: BackupEnvelope = {
      schema_version: 1,
      app_version: '1.3.0',
      app_name: 'Mi Cuaderno Digital',
      exported_at: timestamp,
      counts: {
        customers: customers.length,
        products: products.length,
        sales: sales.length,
        sale_items: sale_items.length,
        debt_records: debt_records.length,
        debt_payments: debt_payments.length,
        supplier_bills: supplier_bills.length,
        store_settings: store_settings.length,
      },
      data: {
        customers,
        products,
        sales,
        sale_items,
        debt_records,
        debt_payments,
        supplier_bills,
        store_settings,
      },
    };

    const jsonContent = JSON.stringify(backupEnvelope, null, 2);

    // 3. Manejo en Web
    if (Platform.OS === 'web') {
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return filename;
    }

    // 4. Manejo en Android / iOS
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const fileUri = `${dir}${filename}`;

    await FileSystem.writeAsStringAsync(fileUri, jsonContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: `Guardar Copia de Seguridad (${filename})`,
        UTI: 'public.json',
      });
    } else {
      throw new Error(
        'La función para compartir archivos no está disponible en este dispositivo.'
      );
    }

    return filename;
  }

  /**
   * Permite al usuario seleccionar un archivo JSON de respaldo, valida su estructura
   * e importa atómicamente todos los datos reemplazando el contenido local.
   */
  async pickAndRestoreBackup(): Promise<RestoreResult | null> {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/json', '*/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
      return null;
    }

    const selectedFile = pickerResult.assets[0];
    let fileContent = '';

    if (Platform.OS === 'web') {
      if (selectedFile.file) {
        fileContent = await selectedFile.file.text();
      } else {
        const response = await fetch(selectedFile.uri);
        fileContent = await response.text();
      }
    } else {
      fileContent = await FileSystem.readAsStringAsync(selectedFile.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
    }

    return await this.restoreFromJson(fileContent);
  }

  /**
   * Procesa y valida el texto JSON para restaurar las tablas de forma atómica
   */
  async restoreFromJson(jsonString: string): Promise<RestoreResult> {
    let parsed: any;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('El archivo seleccionado no es un formato JSON válido.');
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.data) {
      throw new Error(
        'El archivo no coincide con el formato de respaldo de Mi Cuaderno Digital.'
      );
    }

    const data = parsed.data;
    const customers: LocalCustomer[] = Array.isArray(data.customers) ? data.customers : [];
    const products: LocalProduct[] = Array.isArray(data.products) ? data.products : [];
    const sales: LocalSale[] = Array.isArray(data.sales) ? data.sales : [];
    const sale_items: LocalSaleItem[] = Array.isArray(data.sale_items) ? data.sale_items : [];
    const debt_records: LocalDebtRecord[] = Array.isArray(data.debt_records) ? data.debt_records : [];
    const debt_payments: LocalDebtPayment[] = Array.isArray(data.debt_payments) ? data.debt_payments : [];
    const supplier_bills: LocalSupplierBill[] = Array.isArray(data.supplier_bills) ? data.supplier_bills : [];
    const store_settings: LocalStoreSettings[] = Array.isArray(data.store_settings) ? data.store_settings : [];

    const driver = getDatabaseDriver();

    // Ejecución atómica dentro de una transacción
    await driver.transaction(async (tx) => {
      // 1. Limpiar datos existentes en orden inverso de claves foráneas
      await tx.clearStore('sale_items');
      await tx.clearStore('debt_payments');
      await tx.clearStore('debt_records');
      await tx.clearStore('sales');
      await tx.clearStore('supplier_bills');
      await tx.clearStore('products');
      await tx.clearStore('customers');
      await tx.clearStore('store_settings');

      // 2. Insertar configuraciones
      for (const setting of store_settings) {
        await tx.insert('store_settings', setting);
      }

      // 3. Insertar clientes
      for (const customer of customers) {
        await tx.insert('customers', customer);
      }

      // 4. Insertar productos
      for (const product of products) {
        await tx.insert('products', product);
      }

      // 5. Insertar ventas
      for (const sale of sales) {
        await tx.insert('sales', sale);
      }

      // 6. Insertar items de venta
      for (const item of sale_items) {
        await tx.insert('sale_items', item);
      }

      // 7. Insertar deudas (créditos)
      for (const debt of debt_records) {
        await tx.insert('debt_records', debt);
      }

      // 8. Insertar abonos de crédito
      for (const payment of debt_payments) {
        await tx.insert('debt_payments', payment);
      }

      // 9. Insertar cuentas por pagar a proveedores
      for (const bill of supplier_bills) {
        await tx.insert('supplier_bills', bill);
      }

      // 10. Garantizar que la bandera de inicialización quede marcada para evitar precarga de ejemplos
      await tx.setMeta('initial_seed_completed', 'true');
    });

    return {
      success: true,
      message: 'Base de datos restaurada correctamente.',
      counts: {
        customers: customers.length,
        products: products.length,
        sales: sales.length,
        debts: debt_records.length,
        supplier_bills: supplier_bills.length,
      },
    };
  }
}

export const backupService = new BackupService();
