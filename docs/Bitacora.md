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
* **Motor de Reportes en Excel / CSV y Compartir por Celular:**
  * Utilidad `excel.ts` con soporte para UTF-8 BOM y delimitadores `;` compatibles con Excel en español.
  * Reporte detallado de ventas con desglose de artículos y totales.
  * Reporte de cartera y libreta de fiados con saldos y estados.
  * Reporte de inventario con valorización total de la mercancía (capital invertido vs precio de venta).
  * Integración con `expo-sharing` para compartir los archivos generados directamente por WhatsApp, Gmail o guardar en el dispositivo.
