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

- [ ] Verificación de pruebas de sincronización offline/online en Expo.
- [ ] Optimización de migraciones en `docker/init.sql`.
- [ ] Validación de contratos en `packages/shared/`.
