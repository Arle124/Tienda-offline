# Tienda Offline-First · Reglas del Agente y Memoria Persistente

## Memoria y Documentación Técnica
* La documentación destilada, arquitectura técnica y bitácora residen en el repositorio local:
  * Bitácora y estado actual: `docs/Bitacora.md` (o en la Bóveda de Obsidian en `~/Vault/tienda-offline/Bitacora.md`)
  * Visión general y monorepo: `docs/Overview.md`
  * Arquitectura de sincronización: `docs/architecture.md`
  * Flujos operativos: `docs/workflows.md`
  * Grafo y lienzo visual de entidades: `~/Vault/tienda-offline/Grafo/` (en Obsidian)

## Directrices de Eficiencia de Tokens
1. **Consulta primero la documentación:** Antes de inspeccionar los módulos de Expo, React Native o Express, consulta `docs/Overview.md` o `docs/Bitacora.md` para entender el protocolo de sincronización y el estado actual. Esto ahorra hasta un 95% de tokens en cada sesión.
2. **Actualización de bitácora:** Al finalizar un cambio significativo o hito de desarrollo, actualiza la sección de sesiones recientes en `docs/Bitacora.md`.

## Estilo de Desarrollo
* Mantener la filosofía offline-first: transacciones locales instantáneas en SQLite móvil con sincronización asíncrona hacia PostgreSQL.
* Utilizar `packages/shared` para tipos y contratos comunes sin duplicar definiciones entre app y backend.
