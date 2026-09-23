# Tienda Offline-First · Bitácora de Desarrollo

* **Estado del Proyecto:** Monorepo configurado con pnpm, Expo y Express
* **Última revisión:** Septiembre 2026

---

## Componentes y Arquitectura

* **Protocolo de Sincronización:**
  * Cola local de cambios en la app móvil (SQLite).
  * Despacho batch hacia el backend cuando hay conectividad.
  * Resolución de conflictos determinista basada en timestamps y versiones de registro.
* **Módulos Operativos:**
  1. Registro ágil de ventas en mostrador.
  2. Gestión de fiados (cuentas por cobrar por cliente).
  3. Control de existencias e inventario en tiempo real.
  4. Cierre diario de caja.

---

## Tareas y Próximos Pasos

- [x] Implementación modular de pantallas en Expo: Mostrador (`PosScreen`), Cuaderno de Fiados (`DebtorsScreen`), Inventario & Ventas del Día (`InventoryScreen`) y Cierre/Dueña (`OwnerScreen`).
- [x] Consulta instantánea de estado de cuenta tipo libreta (`getCustomerLedger`) con desglose de artículos y registro de abonos atómicos.
- [x] Resumen operativo de ventas diarias (`getTodaySummary`) con cálculo de efectivo físico vs teórico y alertas de existencias bajas.
- [ ] Verificación de pruebas de sincronización offline/online en Expo.
- [ ] Optimización de migraciones en `docker/init.sql`.
- [ ] Validación de contratos en `packages/shared/`.

---

## Sesiones Recientes

### 23 de Septiembre de 2026 - Terminología Comercial Profesional e Inclusiva
* **Sustitución de "Fiado" por "Crédito":**
  * Pestaña y vistas actualizadas a `Créditos` y `Libreta de Créditos`.
  * Etiquetas de métricas (`Total Créditos por Cobrar`, `Crédito Hoy`), alertas y desgloses de compras y abonos renovados para transmitir formalidad financiera.
  * Reportes Excel (.xlsx) y mensajes generados de WhatsApp adaptados con terminología de venta a crédito.
* **Neutralidad de Género y Roles Profesionales:**
  * Eliminación de términos exclusivos de género como "Dueña" y "Tendera".
  * Nueva nomenclatura operativa: `👤 Mostrador` (rol operativo) y `💼 Administración` (rol de gerencia y cierre).
  * Seguridad renovada: `PIN de Administrador`.
* **Rediseño Estructural de Reportes Excel (.xlsx) con Filtros Nativos y Estilos Pasteles:**
  * Eliminación de datos sueltos y textos desalineados en las 4 hojas del sistema (*Ventas*, *Libreta de Créditos*, *Inventario*, *Cierre de Caja*).
  * **Erradicación total de emojis en las hojas de Excel:** Reportes 100% limpios y corporativos, eliminando emoticones decorativos de títulos, encabezados y celdas.
  * **Paleta de Colores Pasteles Suaves y Bordes Delimitados:**
    * Migración al motor `xlsx-js-style` con soporte completo de estilos nativos en celdas (`cell.s`).
    * Colores temáticos pálidos para descansada lectura: Verde menta suave (`#DCFCE7`) en Ventas, Ámbar crema (`#FEF3C7`) en Créditos, Azul cielo suave (`#E0F2FE`) en Inventario y Lavanda tenue (`#EDE9FE`) en Cierre de Caja.
    * Alternancia sutil de filas (*zebra striping* blanco / gris perla `#F8FAFC`) y bordes delgados `#E2E8F0` que separan nítidamente cada celda.
    * Resaltado semántico pálido para estados (alertas de stock crítico en rosa suave `#FEE2E2`, saldos pendientes en crema `#FEF3C7`, saldos al día en verde menta `#F0FDF4`).
    * Fila de totales con doble borde inferior contable estándar.
  * Incorporación de **Autofiltros Nativos de Excel (`!autofilter`)** en cada columna para clasificar y ordenar datos con un clic.

### 22 de Septiembre de 2026 - Módulos de Mostrador, Cuaderno de Fiados e Inventario
* **Navegación por Pestañas Táctiles:** Reemplazo del scroll monolítico de `App.tsx` por 4 pantallas especializadas con barra inferior accesible y badges en tiempo real.
* **Cuaderno Digital de Fiados:**
  * Vista de deudores con cálculo en milisegundos de `current_debt`.
  * Hoja de cliente interactiva: desglose de ventas fiadas con lista de productos, cantidades y precios, más historial de abonos.
  * Modal de abono con atajos rápidos de dinero que actualiza el saldo del cliente de forma transaccional.
* **Inventario & Qué se Vendió Hoy:**
  * Control de existencias con alertas automáticas para productos por debajo del umbral mínimo (`min_stock_alert`).
  * Agregación en tiempo real de artículos vendidos en el día con cantidades y subtotales.
* **Cierre & Arqueo de Caja:**
  * Protección con PIN de Dueña.
  * Comparador entre efectivo físico en cajón y saldo teórico de caja (ventas contado + abonos cobrados).
* **Actualización a Expo SDK 57 & Safe Area Nativo:**
  * Migración de dependencias a Expo SDK 57 (`react-native` 0.86, `react` 19.2, `expo-sqlite` 57).
  * Migración a `react-native-safe-area-context` eliminando la advertencia de `SafeAreaView has been deprecated`.
* **Motor de Reportes en Excel Nativo (.xlsx) con Formato Humano:**
  * Reemplazo del CSV crudo por libros reales `.xlsx` mediante la librería `xlsx` (SheetJS).
  * Tablas con anchos de columna automáticos (`!cols`) para evitar cortes de texto (`###`).
  * Celdas con tipado numérico nativo y formato de moneda (`"$"#,##0`), permitiendo aplicar fórmulas como `SUMA()` o filtros directamente en Excel y Google Sheets.
  * Exportación de reportes independientes (Ventas, Fiados, Inventario) y del **Libro Maestro Integral** con 4 pestañas en un solo archivo: *Cierre de Caja*, *Libreta de Fiados*, *Ventas* e *Inventario*.
  * Integración con `expo-sharing` para compartir el archivo `.xlsx` directamente por WhatsApp, correo o guardarlo en el celular o PC.
* **Control de Salidas de Caja y Pagos a Proveedores:**
  * Repositorio [supplier.repository.ts](file:///home/asher/tienda-offline/apps/mobile/src/database/repositories/supplier.repository.ts) con almacenamiento local offline en `supplier_bills`.
  * Botón ágil `💸 Salida` en el mostrador ([PosScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/pos/PosScreen.tsx)) para registrar en 2 segundos pagos a camiones distribuidores (Bimbo, Coca-Cola) o compras de insumos (bolsas).
  * Descuento automático de las salidas en el Arqueo de Caja del modo Dueña ([OwnerScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/owner/OwnerScreen.tsx)), mostrando el desglose exacto de pagos a repartidores del día.
* **Envío de Estado de Cuenta por WhatsApp en 1 Clic:**
  * Botón `📲 Enviar Cuenta por WhatsApp` en el Cuaderno de Fiados ([DebtorsScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/debtors/DebtorsScreen.tsx)).
  * Mensaje pre-redactado y amigable que incluye el saldo total y el desglose de las últimas compras fiadas con lista de productos y abonos recibidos.
* **Separación de Dinero Físico en Cajón vs Dinero Digital (Nequi / Transferencias):**
  * Soporte integral para cobros por Nequi/Transferencia en [PosScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/pos/PosScreen.tsx) (`payment_type: 'transfer'`) con botón directo `📲 Nequi / Transf.`.
  * Selección de medio de pago al registrar abonos en [DebtorsScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/debtors/DebtorsScreen.tsx) (`💵 Efectivo en Caja` vs `📲 Nequi / Transf.`).
  * Distinción clara en el Cierre de Caja ([OwnerScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/owner/OwnerScreen.tsx)): el arqueo físico solo calcula el dinero de monedas y billetes en cajón (`Ventas Efectivo + Abonos Efectivo − Salidas`), mientras que el dinero digital se agrupa en una tarjeta propia para verificar contra el saldo en la app bancaria.
  * Reportes Excel (.xlsx) actualizados con secciones separadas para efectivo físico y pagos digitales.
* **Actualización Integral del README del Proyecto:**
  * Documentación completa del monorepo, filosofía offline-first (0ms latencia, SQLite local), catálogo exhaustivo de funcionalidades por pantalla, guía de comandos pnpm y enlaces directos a la documentación interna.

