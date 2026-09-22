# Tienda Offline-First · Reglas del Agente y Memoria Persistente

## Memoria a Largo Plazo (Obsidian Vault)
* La documentación destilada, arquitectura técnica y bitácora de este proyecto residen en tu Segundo Cerebro:
  * Bitácora y estado actual: `/home/asher/Vault/tienda-offline/Bitacora.md`
  * Visión general y monorepo: `/home/asher/Vault/tienda-offline/Overview.md`
  * Grafo y lienzo visual de entidades: `/home/asher/Vault/tienda-offline/Grafo/`
  * Especificación técnica local: `docs/architecture.md` y `docs/workflows.md`

## Directrices de Eficiencia de Tokens
1. **Consulta primero la bóveda:** Antes de inspeccionar los módulos de Expo, React Native o Express, consulta `Overview.md` o `Bitacora.md` para entender el protocolo de sincronización y el estado actual. Esto ahorra hasta un 95% de tokens en cada sesión.
2. **Actualización de bitácora:** Al finalizar un cambio significativo o hito de desarrollo, actualiza la sección de sesiones recientes en `/home/asher/Vault/tienda-offline/Bitacora.md`.

## Estilo de Desarrollo
* Mantener la filosofía offline-first: transacciones locales instantáneas en SQLite móvil con sincronización asíncrona hacia PostgreSQL.
* Utilizar `packages/shared` para tipos y contratos comunes sin duplicar definiciones entre app y backend.
