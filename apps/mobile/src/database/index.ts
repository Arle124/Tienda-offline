import { getDatabaseDriver } from './connection';
import { productRepository } from './repositories/product.repository';
import { customerRepository } from './repositories/customer.repository';
import { settingsRepository } from './repositories/settings.repository';

export * from './connection';
export * from './types';
export * from './repositories/product.repository';
export * from './repositories/customer.repository';
export * from './repositories/sale.repository';
export * from './repositories/debt.repository';
export * from './repositories/settings.repository';

/**
 * Inicializa la base de datos local (SQLite en móvil, IndexedDB en Web)
 * y precarga datos esenciales si la base de datos está recién instalada.
 */
export async function initDatabase(): Promise<void> {
  const driver = getDatabaseDriver();
  await driver.init();

  // Asegurar que exista configuración inicial
  await settingsRepository.getSettings();

  // Precarga de productos frecuentes si el catálogo está vacío
  const products = await productRepository.getAll();
  if (products.length === 0) {
    const defaultProducts = [
      { name: 'Pan (Unidad)', price: 500, current_stock: 60, is_favorite: true },
      { name: 'Huevos (Unidad)', price: 800, current_stock: 120, is_favorite: true },
      { name: 'Leche 1L', price: 4200, current_stock: 24, is_favorite: true },
      { name: 'Gaseosa 350ml', price: 2500, current_stock: 36, is_favorite: true },
      { name: 'Arroz 1kg', price: 4000, current_stock: 30, is_favorite: true },
      { name: 'Aceite 500ml', price: 6500, current_stock: 15, is_favorite: true },
    ];

    for (const p of defaultProducts) {
      await productRepository.save(p);
    }
  }

  // Precarga de clientes habituales para fiados si está vacío
  const customers = await customerRepository.getAll();
  if (customers.length === 0) {
    await customerRepository.save({
      name: 'Don Pedro Gómez',
      alias: 'El del taller',
      phone: '3001234567',
    });
    await customerRepository.save({
      name: 'Doña Martha López',
      alias: 'Vecina casa 201',
      phone: '3109876543',
    });
  }
}
