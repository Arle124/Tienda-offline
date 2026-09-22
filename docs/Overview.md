# Tienda Offline-First (El Cuaderno Digital) · Visión General

* **Proyecto:** Sistema integral de mostrador, ventas, inventario y cuentas por cobrar ("fiados") para tienda de barrio.
* **Objetivo:** Operación ágil en dispositivos móviles sin necesidad de conexión constante a Internet, con sincronización automática en segundo plano hacia PostgreSQL.
* **Ubicación en disco:** `/home/asher/tienda-offline`

---

## Estructura del Monorepo

* **`apps/mobile`:**
  * React Native con Expo.
  * Base de datos local SQLite para transacciones con 0ms de latencia.
  * Interfaz optimizada para el mostrador de la tienda.
* **`apps/backend`:**
  * Monolito en Express con TypeScript.
  * Persistencia en PostgreSQL con esquemas relacionales y UUIDs.
* **`packages/shared`:**
  * Tipos de dominio compartidos y contratos del protocolo de sincronización.
* **`docker/`:**
  * Docker Compose para orquestar PostgreSQL y Backend.
* **`docs/`:**
  * `docs/workflows.md`: Los 5 flujos operativos de la tendera.
  * `docs/architecture.md`: Especificación del protocolo de sincronización bidireccional.

---

## Documentación y Grafo

* [[tienda-offline/Bitacora|Bitácora de Desarrollo]]
* [[tienda-offline/Grafo/graph.canvas|Lienzo de Arquitectura (Canvas)]]
* Repositorio local docs: `/home/asher/tienda-offline/docs/`
