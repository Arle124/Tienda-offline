# Tienda Offline-First (El Cuaderno Digital) 🏪📱

> **Sistema integral de punto de venta (POS), libreta digital de fiados, control de inventario y arqueo de caja diseñado con arquitectura Offline-First para tiendas de barrio, minimarkets y pequeños comercios.**

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-black?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%2B-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Local%200ms-003B57?logo=sqlite&logoColor=white)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
[![Express](https://img.shields.io/badge/Express-Backend-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Central%20DB-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pnpm monorepo](https://img.shields.io/badge/pnpm-Monorepo-orange?logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## 🎯 Filosofía y Propuesta de Valor

En una tienda de barrio o mostrador de atención rápida, **el negocio no puede detenerse si se cae el internet o falla el servidor**. El Cuaderno Digital está concebido bajo el principio de **Autonomía Total en el Cliente (Offline-First)**:

* ⚡ **Latencia Cero (0ms):** El 100% de las transacciones (ventas, fiados, abonos, salidas de dinero) se escriben y consultan de forma instantánea en SQLite local dentro del dispositivo móvil.
* 📶 **Independencia de Red:** La aplicación es 100% funcional sin conexión a internet ni dependencia de servidores activos en el momento de la venta.
* 🔄 **Sincronización Silenciosa:** Cola de sincronización local que despacha deltas en lotes (*batch*) hacia el backend en PostgreSQL cuando hay conectividad, utilizando resolución determinista *Last-Write-Wins (LWW)*.
* 🆔 **Identificadores UUID v4 & Soft Deletes:** Cada entidad se genera con ID universal en el dispositivo y las eliminaciones son lógicas (`is_deleted = TRUE`) para garantizar consistencia y replicabilidad en red.

---

## 🚀 Módulos y Funcionalidades

### 🛒 1. Mostrador y Punto de Venta (POS)
* **Venta rápida al contado:** Botones táctiles de productos favoritos y teclado numérico directo para ventas por valor (`+ Varios`).
* **Atajos de efectivo y vuelto:** Botones rápidos de denominación (`Exacto`, `$10.000`, `$20.000`, `$50.000`) con cálculo automático del cambio y feedback háptico.
* **Separación de medios de pago:** Soporte nativo para cobros en **Efectivo en Caja** y **Dinero Digital (Nequi / Transferencias bancarias)**.
* **Salidas de caja ágiles (`💸 Salida`):** Registro en 2 segundos de pagos a camiones distribuidores (Bimbo, Coca-Cola) o compras de insumos (bolsas), afectando inmediatamente el arqueo de caja.
* **Fiar en 1 toque:** Asignación directa de la cuenta a un cliente de confianza sin formularios burocráticos.

### 📖 2. Cuaderno Digital de Fiados (Cuentas por Cobrar)
* **Reemplazo de la libreta de papel:** Vista de deudores con cálculo en milisegundos de saldos acumulados y búsqueda rápida.
* **Ficha detallada del cliente:** Historial tipo extracto con desglose de artículos comprados (nombre, cantidad, precio) y abonos previos.
* **Abonos atómicos:** Registro ágil de pagos parciales o totales, especificando si ingresan como efectivo al cajón o por transferencia/Nequi.
* **Envío de estado de cuenta por WhatsApp (`📲 1 Clic`):** Genera y abre un mensaje pre-redactado y amigable con el saldo total y las compras recientes para enviar al cliente.

### 📦 3. Inventario y Control de Existencias ("Semáforo")
* **Alertas automáticas de existencias:** Clasificación visual de productos con stock agotado o por debajo del umbral mínimo de reposición (`min_stock_alert`).
* **Descuento de stock en tiempo real:** Cada venta física descuenta inventario automáticamente de forma transaccional.
* **Resumen "¿Qué se vendió hoy?":** Monitor en tiempo real de artículos despachados durante la jornada con conteo de unidades y subtotales.

### 🔐 4. Arqueo y Cierre Diario de Caja (Modo Dueña)
* **Protección por PIN de seguridad:** Acceso restringido para dueña o supervisora.
* **Arqueo físico estricto:** Comparación automática entre el dinero físico contado en cajón y el saldo teórico de caja:
  $$\text{Efectivo Teórico en Cajón} = \text{Ventas en Efectivo} + \text{Abonos en Efectivo} - \text{Salidas a Proveedores}$$
* **Tarjeta de Dinero Digital independiente:** Agrupación consolidada de cobros y abonos por Nequi / Transferencia para verificar contra la app bancaria sin descuadrar el cajón físico.
* **Historial de salidas:** Detalle de comprobantes pagados a distribuidores y repartidores durante el día.

### 📊 5. Motor de Reportes en Excel Nativo (`.xlsx`)
* **Libros Excel reales con SheetJS:** Adiós a archivos CSV crudos; exporta libros `.xlsx` con anchos de columna automáticos (`!cols`).
* **Formato de moneda profesional:** Celdas con tipado numérico y formato nativo (`"$"#,##0`) compatibles con fórmulas (`SUMA()`), filtros y tablas dinámicas en Microsoft Excel y Google Sheets.
* **Exportación modular y Libro Maestro:**
  * Reporte de Ventas del Día.
  * Libreta de Cuentas por Cobrar (Fiados).
  * Reporte de Inventario y Alertas de Stock.
  * **Libro Maestro Integral:** Archivo consolidado con las 4 hojas de trabajo en un solo documento (*Cierre de Caja*, *Libreta de Fiados*, *Ventas*, *Inventario*).
* **Compartir directo vía `expo-sharing`:** Envío del reporte por WhatsApp, correo electrónico o guardado en el almacenamiento del dispositivo o PC.

---

## 🏗️ Arquitectura del Monorepo

```
tienda-offline/
├── apps/
│   ├── mobile/             # Aplicación móvil en React Native (Expo SDK 57)
│   │   ├── src/
│   │   │   ├── database/   # SQLite local (repositorios, esquemas, migraciones)
│   │   │   ├── screens/    # Pantallas: Mostrador, Fiados, Inventario, Dueña
│   │   │   ├── utils/      # Generador Excel (.xlsx), helpers crypto y uuid
│   │   │   └── sync/       # Cola y motor de sincronización offline
│   │   └── App.tsx         # Contenedor raíz y navegación por pestañas táctiles
│   │
│   └── backend/            # Monolito API en Express + TypeScript
│       ├── src/            # Controladores, rutas y servicios de sincronización
│       └── Dockerfile      # Contenedor optimizado para backend
│
├── packages/
│   └── shared/             # Contratos de dominio compartidos y protocolo DTO
│       └── src/
│           ├── types.ts    # Interfaces de entidades (Product, Customer, Sale, etc.)
│           └── sync.ts     # Esquemas de Push y Pull para sincronización
│
├── docker/
│   ├── docker-compose.yml  # Orquestación de PostgreSQL y Backend
│   └── init.sql            # Esquema relacional con UUIDs, índices y soft deletes
│
└── docs/
    ├── Bitacora.md         # Bitácora detallada de hitos y sesiones de desarrollo
    ├── Overview.md         # Visión general técnica y mapa del monorepo
    ├── workflows.md        # Especificación de los 5 flujos operativos de mostrador
    └── architecture.md     # Protocolo de datos y sincronización bidireccional
```

---

## 🛠️ Tecnologías Principales

| Capa | Tecnologías |
| :--- | :--- |
| **Móvil (Frontend)** | React Native 0.86, Expo SDK 57, TypeScript, `expo-sqlite`, `react-native-safe-area-context`, `expo-sharing`, `expo-haptics`, `xlsx` (SheetJS) |
| **Backend** | Node.js, Express, TypeScript, `tsx` |
| **Bases de Datos** | **Cliente:** SQLite local (0ms latencia) <br> **Servidor:** PostgreSQL 16 con UUIDs v4 |
| **Monorepo** | pnpm Workspaces, TypeScript Project References |
| **Infraestructura** | Docker & Docker Compose |

---

## 📋 Requisitos Previos

* **Node.js**: `v20.x` o `v22.x` (LTS recomendado).
* **pnpm**: `v9.x` o superior (`corepack enable && corepack use pnpm@latest`).
* **Docker & Docker Compose**: Opcional, necesario para levantar el backend central y PostgreSQL.
* **Dispositivo Móvil**: Aplicación [Expo Go](https://expo.dev/go) (Android / iOS) para probar en hardware real, o un navegador web.

---

## ⚡ Guía de Instalación y Uso Rápido

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/Arle124/Tienda-offline.git
cd tienda-offline
pnpm install
```

### 2. Compilar el paquete de contratos compartidos
```bash
pnpm build:shared
```

### 3. Ejecutar la aplicación móvil
Tienes varias formas de ejecutar el frontend móvil:

```bash
# Iniciar servidor de desarrollo de Expo (lector de código QR para Expo Go)
pnpm mobile

# Iniciar con túnel ngrok (ideal para probar en celular físico fuera de la red local)
pnpm mobile:tunnel

# Iniciar en el navegador web (con almacenamiento SQLite emulado)
pnpm mobile:web
```

### 4. Ejecutar el backend y la base de datos central (Opcional)
```bash
# Levantar PostgreSQL y servicios mediante Docker
pnpm docker:up

# Iniciar el backend en modo desarrollo con recarga en vivo
pnpm backend

# Para apagar los servicios Docker
pnpm docker:down
```

---

## ⌨️ Scripts Disponibles en el Monorepo

| Comando | Descripción |
| :--- | :--- |
| `pnpm mobile` | Inicia Expo CLI para la aplicación móvil en modo interactivo. |
| `pnpm mobile:tunnel` | Inicia Expo mediante túnel seguro (ngrok) para conexión remota. |
| `pnpm mobile:web` | Compila y sirve la aplicación en el navegador web local. |
| `pnpm backend` | Inicia el servidor Express en desarrollo con recarga automática (`tsx watch`). |
| `pnpm build:shared` | Compila el paquete TypeScript `@tienda/shared` a JavaScript y definiciones `.d.ts`. |
| `pnpm docker:up` | Levanta los contenedores de PostgreSQL y Backend en segundo plano. |
| `pnpm docker:down` | Detiene y remueve los contenedores de Docker. |

---

## 📖 Documentación y Memoria del Proyecto

* 📓 [Bitácora de Desarrollo](docs/Bitacora.md): Registro cronológico de cambios, sesiones técnicas y decisiones de implementación.
* 🗺️ [Visión General](docs/Overview.md): Estructura general del proyecto y enlaces a la base de conocimiento en Obsidian.
* 🔄 [Arquitectura de Sincronización](docs/architecture.md): Especificación del protocolo bidireccional, resolución LWW y esquema de deltas.
* 🛍️ [Flujos Operativos](docs/workflows.md): Detalle paso a paso de los 5 momentos clave del mostrador de la tendera.

---

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia ISC. Consulte el repositorio para más detalles.
