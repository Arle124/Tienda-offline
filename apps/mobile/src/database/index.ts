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
export * from './repositories/supplier.repository';
export * from './repositories/settings.repository';

/**
 * Inicializa la base de datos local (SQLite en móvil, IndexedDB en Web)
 * y precarga datos iniciales una única vez si la base de datos es nueva.
 */
export async function initDatabase(): Promise<void> {
  const driver = getDatabaseDriver();
  await driver.init();

  // Asegurar que exista configuración inicial
  await settingsRepository.getSettings();

  // Verificar si la base de datos ya completó la precarga inicial
  const isSeeded = await driver.getMeta('initial_seed_completed');
  if (isSeeded === 'true') {
    return;
  }

  // Si no está marcado como seeded, verificar si ya existen registros previos (incluso eliminados)
  // para evitar reinsertar datos en instalaciones existentes
  const [existingProducts, existingCustomers] = await Promise.all([
    productRepository.getAll(true),
    customerRepository.getAll(true),
  ]);

  if (existingProducts.length > 0 || existingCustomers.length > 0) {
    // Ya existen datos en la base de datos; marcamos como seeded para nunca volver a reinsertar
    await driver.setMeta('initial_seed_completed', 'true');
    return;
  }

  // Base de datos completamente nueva: Precargar catálogo y clientes de ejemplo por única vez
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

  const defaultCustomers = [
    {
      name: 'Don Pedro Gómez',
      alias: 'El del taller',
      phone: '3001234567',
    },
    {
      name: 'Doña Martha López',
      alias: 'Vecina casa 201',
      phone: '3109876543',
    },
  ];

  for (const c of defaultCustomers) {
    await customerRepository.save(c);
  }

  await driver.setMeta('initial_seed_completed', 'true');
}

