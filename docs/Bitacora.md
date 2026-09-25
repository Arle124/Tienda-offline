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

### 24 de Septiembre de 2026 - Versión 1.2.0 (versionCode 4): Cuentas por Pagar a Proveedores y Ajuste de Cabecera Móvil
* **Ajuste y Corrección de Solapamiento en Cabecera Móvil ([App.tsx](file:///home/asher/tienda-offline/apps/mobile/App.tsx)):**
  * El contenedor del título `"Mi Cuaderno Digital"` y subtítulo ahora tiene `flex: 1` con margen derecho controlado y truncado por elipsis (`numberOfLines={1}`).
  * El botón de rol de administración se optimizó visualmente como `"💼 Admin"` con `flexShrink: 0`, garantizando que en teléfonos con pantallas compactas el título nunca se solape con el botón de rol o el engranaje de configuración `⚙️`.
* **Módulo Completo de Cuentas por Pagar a Proveedores (`supplier_bills`):**
  * **Problema Resuelto:** Al registrar compras a crédito con repartidores ("Quedar debiendo" / `is_paid = false`) desde el botón `💸 Salida` de Mostrador, las facturas quedaban guardadas en SQLite pero no se reflejaban en ninguna interfaz de la aplicación.
  * **Mostrador ([PosScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/pos/PosScreen.tsx)):**
    * Badge numérico en el botón `💸 Salida` que indica cuántas facturas a crédito están pendientes de pago.
    * Modal de salida con dos pestañas: `➕ Nueva Salida` y `📋 Por Pagar (N)`.
    * Acción de pago directo con efectivo de caja (`💵 Pagar Caja`) con confirmación, actualización inmediata y alerta toast reactiva, además de opción de borrado (`🗑️`).
  * **Libreta de Créditos ([DebtorsScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/debtors/DebtorsScreen.tsx)):**
    * Selector de segmento superior: `📒 Vecinos (N)` y `🚚 Proveedores (N)`.
    * En la vista de proveedores: tarjeta de total adeudado a proveedores, buscador por nombre de empresa o notas, tarjetas individuales con fecha y monto, botones de pago con caja y eliminación, y modal `+ Factura` para registrar nuevas deudas comerciales con repartidores.
  * **Administración y Cierre ([OwnerScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/owner/OwnerScreen.tsx)):**
    * Tarjeta KPI destacada de cuentas por pagar a proveedores.
    * Sección dedicada con listado de facturas, liquidación directa contra caja y botón de registro de facturas pendientes.
  * **Repositorio de Proveedores ([supplier.repository.ts](file:///home/asher/tienda-offline/apps/mobile/src/database/repositories/supplier.repository.ts)):**
    * Implementación de `softDelete` y `hardDelete`.
    * Ordenamiento descendente en `getPendingBills()`.
    * Al liquidarse con `markAsPaid()`, la factura se contabiliza de forma automática en el arqueo diario de caja en `supplierRepository.getTodayPaidOutflows()`.
* **Incremento de Versión y Compilación Local Exitosa:**
  * `apps/mobile/app.json`: `version: "1.2.0"`, `versionCode: 4`.
  * `apps/mobile/package.json`: `version: "1.2.0"`.
  * **Compilación Local de APK Autónoma:** Generación exitosa de `build-1790284983977.apk` (~97.9 MB) en 298.3s (~4.9 min) en Fedora local vía EAS CLI. Listo para instalación en dispositivo o distribución.

### 24 de Septiembre de 2026 - Corrección de Persistencia en Eliminación de Clientes y Productos de Ejemplo (Idempotencia de Precarga)
* **Diagnóstico de Reaparición de Datos de Ejemplo ([index.ts](file:///home/asher/tienda-offline/apps/mobile/src/database/index.ts)):**
  * Al eliminar los vecinos de ejemplo (*Don Pedro Gómez* y *Doña Martha López*) o los productos iniciales, el borrado lógico (`is_deleted = true`) los ocultaba correctamente de la interfaz en tiempo de ejecución.
  * Sin embargo, al cerrar y volver a abrir la aplicación, la función `initDatabase()` volvía a ejecutarse y consultaba `customerRepository.getAll()` y `productRepository.getAll()`. Como estos métodos excluyen por defecto los registros borrados, al quedar el listado activo en 0, `initDatabase()` asumía erróneamente que la base de datos estaba recién instalada y volvía a insertar clientes y productos de ejemplo con nuevos UUIDs.
* **Idempotencia y Bandera de Precarga Única (`initial_seed_completed`):**
  * Uso de la tabla `sync_meta` para persistir la bandera `'initial_seed_completed'`.
  * Verificación previa con `getAll(true)`: si ya existen registros en SQLite (incluso borrados), se marca la bandera sin reinsertar nada.
  * Garantía estricta de que el catálogo y vecinos de ejemplo solo se precargan una única vez en la vida de la base de datos, permitiendo al comerciante eliminar libremente los ejemplos sin que reaparezcan al reiniciar la aplicación.
* **Integridad Transaccional al Eliminar Clientes ([customer.repository.ts](file:///home/asher/tienda-offline/apps/mobile/src/database/repositories/customer.repository.ts)):**
  * Al invocar `customerRepository.softDelete(id)`, se archivan atómicamente dentro de la misma transacción todas las deudas activas asociadas en `debt_records`, evitando registros huérfanos.
  * Inclusión de método `hardDelete` tanto en `customerRepository` como en `productRepository` para operaciones de depuración o purga completa si fuera requerida.

### 23 de Septiembre de 2026 - Botón de Ajustes (⚙️), Roles y Moneda Internacional Dinámica
* **Botón Universal de Ajustes en Barra Superior ([App.tsx](file:///home/asher/tienda-offline/apps/mobile/App.tsx)):**
  * Icono de tuerca `⚙️` en la cabecera junto al rol operativo, accesible desde cualquier vista de la aplicación.
* **Componente y Modal de Ajustes ([SettingsModal.tsx](file:///home/asher/tienda-offline/apps/mobile/src/components/SettingsModal.tsx)):**
  * **División por Roles con Candado de Seguridad:**
    * *Modo Mostrador:* Acceso libre a preferencias de dispositivo (vibración háptica, modo offline autónomo de 0ms) e información del sistema. Bloqueo con PIN de 4 dígitos para ingresar a la configuración del negocio.
    * *Modo Administración:* Acceso directo o desbloqueado a datos de la tienda, cambio de PIN y formato regional.
  * **Soporte de Moneda Internacional Multi-País:**
    * Chips rápidos de divisas (`$`, `S/`, `Bs`, `Q`, `€`, `₡`) y campo personalizado para cualquier prefijo.
    * Interruptor para manejo de decimales (centavos) adaptado a cada país (ej: Colombia/Chile sin decimales `$25.000` vs Perú/México con centavos `S/ 25.50`).
    * Vista previa en vivo del formato monetario en tiempo real.
  * **Identidad Comercial:**
    * Configuración de nombre de la tienda y teléfono de contacto para estados de cuenta de WhatsApp y reportes contables.
* **Contexto Global de Configuración ([SettingsContext.tsx](file:///home/asher/tienda-offline/apps/mobile/src/context/SettingsContext.tsx)):**
  * Proveedor reactivo `SettingsProvider` y función global `formatMoney()`.
  * Integración en todas las pantallas ([PosScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/pos/PosScreen.tsx), [DebtorsScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/debtors/DebtorsScreen.tsx), [InventoryScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/inventory/InventoryScreen.tsx), [OwnerScreen.tsx](file:///home/asher/tienda-offline/apps/mobile/src/screens/owner/OwnerScreen.tsx)) y toasts con respuesta háptica condicional.
* **Migraciones de Base de Datos SQLite:**
  * Inclusión de columnas `currency_symbol`, `use_decimals`, `store_phone` y `haptic_enabled` en tabla `store_settings` con migraciones seguras y tipado estricto en `@tienda/shared`.

### 23 de Septiembre de 2026 - Erradicación de Alertas del Sistema y Toasts Flotantes Profesionales
* **Componente Global de Notificaciones (`Toast.tsx`):**
  * Creación de `ToastProvider` y hook `useToast()` accesible desde cualquier pantalla.
  * Diseño flotante superior en pizarra oscura (`#0F172A`) con bordes de color semántico (verde esmeralda para ventas cobradas, ámbar para advertencias, rojo para errores, azul para sincronización).
  * Animación fluida con resortes (`spring`), desaparición automática en 3 segundos y cierre táctil instantáneo.
  * Vibración háptica diferenciada (`expo-haptics`) según el tipo de evento (éxito, advertencia, error).
* **Eliminación Total de `Alert.alert` y `alert()`:**
  * Reemplazo en `PosScreen`: ventas en efectivo (mostrando el cambio o devuelta), pagos digitales por Nequi/transferencia, créditos guardados en libreta y salidas de caja. Ya no se bloquea la pantalla con cuadros de diálogo grises de Android tras cada venta.
  * Reemplazo en `OwnerScreen`: actualización de PIN de administración, exportación de reportes Excel y estado de cola de sincronización.

### 23 de Septiembre de 2026 - Habilitación de Entorno Local de Compilación Android (Offline EAS Build)
* **Entorno de Compilación Local en Fedora:**
  * Descarga y configuración del Android SDK en `~/Android/Sdk` (`cmdline-tools`, `platform-tools` con `adb`, plataforma `android-36` y `build-tools;36.0.0`).
  * Aceptación de licencias oficiales de Android e integración con JDK 17 (Eclipse Temurin).
  * Variables persistentes en `.bashrc`: `ANDROID_HOME`, `JAVA_HOME` y rutas de binarios.
* **Compilación Local de APK Autónoma y Ultrarrápida:**
  * Ejecución exitosa de `npx eas-cli build --platform android --profile preview --local` dentro de `apps/mobile`.
  * Generación del APK (`build-1790194307618.apk`, ~98 MB) en tan solo 5 minutos aprovechando los 12 hilos de la CPU Ryzen, eliminando la dependencia y esperas de cola en la nube de EAS.

### 23 de Septiembre de 2026 - Terminología Comercial Profesional e Inclusiva
* **Sustitución de "Fiado" por "Crédito":**
  * Pestaña y vistas actualizadas a `Créditos` y `Libreta de Créditos`.
  * Etiquetas de métricas (`Total Créditos por Cobrar`, `Crédito Hoy`), alertas y desgloses de compras y abonos renovados para transmitir formalidad financiera.
  * Reportes Excel (.xlsx) y mensajes generados de WhatsApp adaptados con terminología de venta a crédito.
* **Neutralidad de Género y Roles Profesionales:**
  * Eliminación de términos exclusivos de género como "Dueña" y "Tendera".
  * Nueva nomenclatura operativa: `👤 Mostrador` (rol operativo) y `💼 Administración` (rol de gerencia y cierre).
  * Seguridad renovada: `PIN de Administrador`.
* **Cambio de Nombre Comercial:**
  * Transición de "El Cuaderno Digital" a **"Mi Cuaderno Digital"**, aportando un sentido de cercanía, pertenencia e identidad para el comerciante.
  * Verificación en Google Play Store: nombre disponible y sin colisión con aplicaciones comerciales o de puntos de venta.
  * Actualización aplicada en `app.json`, cabecera de `App.tsx`, reportes de Excel y mensajes automáticos de WhatsApp.
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

