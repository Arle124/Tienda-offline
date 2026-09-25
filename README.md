# Tienda Offline-First (Mi Cuaderno Digital)

> Sistema integral de punto de venta (POS), libreta de créditos comerciales, cuentas por pagar a proveedores, control de inventario y arqueo de caja. Diseñado bajo una arquitectura de soberanía de datos y funcionamiento autónomo (Offline-First) para pequeños comercios, abarrotes y minimarkets.

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2057-black?logo=expo&logoColor=white)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6%2B-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Local%200ms-003B57?logo=sqlite&logoColor=white)](https://docs.expo.dev/versions/latest/sdk/sqlite/)
[![Express](https://img.shields.io/badge/Express-Backend-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Central%20DB-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![pnpm monorepo](https://img.shields.io/badge/pnpm-Monorepo-orange?logo=pnpm&logoColor=white)](https://pnpm.io/)

---

## Principios y Propuesta de Valor

En el comercio independiente y las tiendas de mostrador rápido, la operación diaria no puede depender de la estabilidad del internet o de la disponibilidad de un servidor externo. Mi Cuaderno Digital se basa en los siguientes fundamentos arquitectónicos:

* **Latencia Cero (0 ms):** Todas las operaciones comerciales (ventas, fiados, abonos, salidas de dinero y recepción de facturas) se ejecutan de manera instantánea sobre SQLite en la memoria local del dispositivo.
* **Autonomía Operativa Total:** La aplicación funciona al 100% sin conexión a internet ni requerimiento de cuentas en la nube para su uso diario.
* **Soberanía y Privacidad de Datos:** Los datos contables pertenecen exclusivamente al usuario. No se transmite telemetría, no se analizan patrones de compra ni se comercializa información privada.
* **Respaldos y Portabilidad Local:** Mecanismo integrado de exportación atómica en formato JSON (.json) compatible con Google Drive, WhatsApp y almacenamiento físico, sin intermediarios ni costos mensuales de servidor.
* **Sincronización Opcional en Lotes:** Capacidad de sincronización asíncrona hacia backend PostgreSQL cuando exista conectividad, mediante cola de deltas y resolución determinista de conflictos (Last-Write-Wins).

---

## Módulos del Sistema

### 1. Mostrador y Punto de Venta (POS)
* **Venta rápida de productos:** Cuadrícula táctil de artículos favoritos y teclado para ventas por monto libre sin registro previo.
* **Atajos de denominación y vuelto:** Botones rápidos de pago en efectivo (Exacto, 10.000, 20.000, 50.000, etc.) con cálculo instantáneo del cambio y respuesta háptica.
* **Cobros mixtos:** Separación explícita entre efectivo en cajón y transferencias digitales (Nequi, Daviplata o transferencias bancarias).
* **Escáner óptico de códigos de barras:** Lectura de códigos estándar (EAN-13, EAN-8, UPC, Code-128, QR) mediante la cámara del dispositivo para incorporación directa al carrito de compras.
* **Salidas de caja operativas:** Registro de pagos en efectivo a repartidores o compras imprevistas de insumos, descontándose de inmediato del efectivo físico esperado en el arqueo.
* **Créditos comerciales directos:** Asignación de la venta a la cuenta corriente del cliente en un solo paso.

### 2. Cuaderno Digital de Créditos (Cuentas por Cobrar)
* **Control de cartera:** Listado consolidado de clientes con saldo pendiente y búsqueda rápida por nombre o apodo.
* **Historial y estado de cuenta:** Detalle cronológico tipo libreta con desglose de artículos adquiridos a crédito y pagos realizados.
* **Registro de abonos atómicos:** Cobro parcial o total de la deuda, con registro contable de si ingresó como efectivo a caja o por transferencia bancaria.
* **Notificación por WhatsApp:** Generación de mensajes estructurados con el balance actualizado y los últimos movimientos para compartir directamente con el cliente.

### 3. Cuentas por Pagar a Proveedores
* **Gestión de facturas a crédito:** Registro de facturas pendientes con empresas distribuidoras y preventistas (Bimbo, Postobón, Coca-Cola, etc.).
* **Pago directo desde caja:** Opción de liquidar facturas con el efectivo disponible en mostrador, actualizando de inmediato el cuadre del día.
* **Protección contra borrado accidental:** Diálogo nativo de confirmación antes de eliminar cualquier comprobante por pagar.

### 4. Inventario y Control de Existencias
* **Monitoreo de existencias:** Detección de productos agotados o con existencias por debajo del umbral mínimo configurado.
* **Búsqueda multimodal:** Filtrado instantáneo por nombre de producto o por dígitos de código de barras.
* **Asignación de códigos por cámara:** Lectura del código de barras desde la ficha del producto para agilizar su posterior cobro en mostrador.
* **Resumen diario de ventas:** Visualización de las unidades vendidas por artículo durante la jornada en curso.

### 5. Arqueo y Cierre Diario de Caja
* **Acceso administrativo protegido:** Control de entrada mediante PIN de 4 dígitos para resguardar la información económica.
* **Cuadre de caja:** Comparación entre el efectivo físico contado en el cajón y el saldo teórico calculado:
  $$\text{Efectivo Esperado} = \text{Ventas Contado} + \text{Abonos en Efectivo} - \text{Salidas Registradas}$$
* **Indicadores visuales de balance:** Estados claros para caja cuadrada exactamente, sobrantes o faltantes de dinero.
* **Separación de ingresos digitales:** Tarjeta independiente para conciliar pagos digitales recibidos en Nequi o cuentas bancarias, evitando descuadres en el cajón físico.

### 6. Motor de Reportes en Microsoft Excel (.xlsx)
* **Generación nativa sin internet:** Creación directa de archivos `.xlsx` mediante `xlsx-js-style` con formato numérico de moneda (`"$"#,##0`), estilos visuales suaves y anchos de columna dinámicos.
* **Variedad de reportes:**
  * Reporte detallado de ventas del día.
  * Libreta de créditos y estado de cartera de clientes.
  * Inventario general valorizado y costos de adquisición.
  * Libro Maestro Integral: Archivo único que consolida las 4 hojas de trabajo (Cierre de Caja, Libreta de Créditos, Ventas e Inventario).
* **Distribución:** Envío de reportes por WhatsApp, correo electrónico o guardado en el almacenamiento local mediante la hoja de compartir nativa de Android.

### 7. Copias de Seguridad y Respaldo
* **Exportación atómica:** Generación de un archivo JSON estructurado (`schema_version: 1`) con la totalidad de los datos comerciales (productos, clientes, ventas, créditos, abonos, cuentas por pagar y ajustes).
* **Restauración segura:** Importación transaccional con validación de esquema para restablecer la tienda en dispositivos nuevos o tras formateos.
* **Marco legal integrado:** Documento de términos de uso y política de privacidad accesible dentro de la aplicación, adecuado para su publicación en tiendas como Aptoide.

---

## Arquitectura del Monorepo

```
tienda-offline/
├── apps/
│   ├── mobile/             # Aplicación móvil en React Native (Expo SDK 57)
│   │   ├── src/
│   │   │   ├── components/ # Modales de cámara, términos, alertas y escáner
│   │   │   ├── database/   # SQLite local (repositorios, esquemas, migraciones)
│   │   │   ├── screens/    # Mostrador, Fiados, Inventario y Administración
│   │   │   ├── services/   # Servicio de respaldo y restauración atómica
│   │   │   └── utils/      # Generador de reportes Excel (.xlsx) y formateadores
│   │   ├── app.json        # Configuración de Expo y permisos de Android
│   │   └── App.tsx         # Contenedor raíz y navegación táctil
│   │
│   └── backend/            # API opcional en Express + TypeScript
│       ├── src/            # Rutas y controladores de sincronización central
│       └── Dockerfile      # Contenedor para despliegues de sincronización
│
├── packages/
│   └── shared/             # Contratos de dominio comunes (DTOs y modelos)
│       └── src/
│           ├── types.ts    # Definiciones de tipos (Product, Customer, Sale, Bill)
│           └── sync.ts     # Protocolo de transferencia Push/Pull
│
├── docker/
│   ├── docker-compose.yml  # Orquestación de PostgreSQL y Backend
│   └── init.sql            # Esquema relacional con UUIDs y soft deletes
│
└── docs/
    ├── Bitacora.md         # Registro de avances técnicos y decisiones de diseño
    ├── Overview.md         # Mapa general del monorepo y contexto
    ├── workflows.md        # Especificación de flujos de mostrador
    └── architecture.md     # Arquitectura de sincronización y base de datos
```

---

## Tecnologías Utilizadas

| Capa | Componentes |
| :--- | :--- |
| **Móvil (Cliente Autónomo)** | React Native 0.86, Expo SDK 57, TypeScript, `expo-sqlite`, `expo-camera`, `expo-sharing`, `expo-document-picker`, `expo-file-system`, `expo-haptics`, `xlsx-js-style` |
| **Backend (Opcional)** | Node.js, Express, TypeScript, `tsx` |
| **Almacenamiento** | Local: SQLite (0 ms de latencia) / Central: PostgreSQL 16 con UUIDs v4 |
| **Monorepo** | pnpm Workspaces, TypeScript Project References |
| **Empaquetado Nativo** | EAS Build (Android SDK 36, APK / AAB) |

---

## Requisitos de Entorno

* **Node.js:** Versión 20.x o 22.x LTS.
* **pnpm:** Versión 9.x o superior (`corepack enable && corepack use pnpm@latest`).
* **Android / Dispositivo:** Dispositivo con Android 8.0 o superior (o Expo Go para desarrollo rápido).
* **Docker:** Opcional, requerido únicamente si se ejecuta el backend central con PostgreSQL.

---

## Instalación y Puesta en Marcha

### 1. Clonar el repositorio e instalar dependencias
```bash
git clone https://github.com/Arle124/Tienda-offline.git
cd tienda-offline
pnpm install
```

### 2. Compilar contratos compartidos
```bash
pnpm build:shared
```

### 3. Iniciar la aplicación móvil en desarrollo
```bash
# Iniciar servidor interactivo de Expo (código QR para Expo Go)
pnpm mobile

# Iniciar con túnel ngrok (pruebas en hardware físico remoto)
pnpm mobile:tunnel

# Iniciar versión web local con emulación IndexedDB
pnpm mobile:web
```

### 4. Compilar APK para distribución en tiendas (Aptoide / Instalación directa)
```bash
cd apps/mobile
npx eas-cli build --platform android --profile preview --local
```

### 5. Servicios centrales y base de datos de respaldo (Opcional)
```bash
# Iniciar PostgreSQL y Backend con Docker
pnpm docker:up

# Iniciar servidor Express en desarrollo
pnpm backend

# Detener contenedores
pnpm docker:down
```

---

## Scripts Disponibles

| Comando | Acción |
| :--- | :--- |
| `pnpm mobile` | Inicia el entorno de desarrollo de Expo para la app móvil. |
| `pnpm mobile:tunnel` | Inicia Expo con túnel para conexión remota en red celular. |
| `pnpm mobile:web` | Ejecuta la aplicación en el navegador web local. |
| `pnpm backend` | Inicia el servidor Express con recarga en caliente (`tsx watch`). |
| `pnpm build:shared` | Compila `@tienda/shared` a definiciones y JavaScript. |
| `pnpm docker:up` | Despliega PostgreSQL y el backend en contenedores Docker. |
| `pnpm docker:down` | Detiene y remueve los contenedores locales de Docker. |

---

## Documentación Técnica

* [Bitácora de Desarrollo](docs/Bitacora.md): Registro histórico de cambios, decisiones técnicas y versiones publicadas.
* [Visión General del Proyecto](docs/Overview.md): Estructura detallada del monorepo y contexto operativo.
* [Arquitectura de Sincronización](docs/architecture.md): Protocolo de comunicación, estructura de tablas y resolución LWW.
* [Flujos de Trabajo](docs/workflows.md): Especificación detallada de los procesos de mostrador, cobro y crédito.

---

## Licencia

Distribuido bajo la Licencia ISC. Consulte el archivo de licencia en el repositorio para mayores detalles.
