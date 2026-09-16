# Arquitectura Offline-First

## 1. Principios de Diseño

1. **Autonomía Total en el Cliente (Mobile First):**
   - El celular es la fuente primaria de verdad en tiempo de ejecución.
   - Si no hay conexión o el servidor está apagado, el 100% de las funciones de venta, fiados y abonos siguen operando con latencia cero.
2. **Identificadores Universales (UUID v4):**
   - No se usan secuencias ni autoincrementales (`SERIAL`).
   - Todo ID de registro se genera en el celular antes de cualquier sincronización.
3. **Borrado Lógico (Soft Deletes):**
   - Las operaciones de eliminación marcan `is_deleted = TRUE` y actualizan `updated_at = NOW()`.
   - Garantiza que los registros eliminados offline se propaguen al backend al recuperar señal.
4. **Inmutabilidad y Auditoría:**
   - Columnas estándar en todas las tablas: `id`, `created_at`, `updated_at`, `is_deleted`.

---

## 2. Flujo de Sincronización Bidireccional

```
┌─────────────────────────┐               ┌─────────────────────────┐
│     CLIENTE MÓVIL       │               │     BACKEND SERVIDOR    │
│    (SQLite / Local)     │               │       (PostgreSQL)      │
└────────────┬────────────┘               └────────────┬────────────┘
             │                                         │
             │   1. Push: Registros pendientes         │
             ├────────────────────────────────────────>│
             │      (sync_status != 'synced')          │
             │                                         │
             │                                         │ 2. Transacción Atómica:
             │                                         │    - UPSERT con LWW
             │                                         │    - Inserción de deltas
             │                                         │
             │   3. Pull: Cambios en el servidor       │
             │<────────────────────────────────────────┤
             │      (updated_at > last_sync)           │
             │                                         │
             │ 4. Actualización local:                 │
             │    - Marcar como 'synced'               │
             │    - Guardar nuevo last_sync_timestamp  │
             ▼                                         ▼
```

### Estrategia de Resolución de Conflictos: *Last-Write-Wins (LWW)*
Al ser un negocio uniusuario (una sola persona operando la tienda), los conflictos de edición simultánea son virtualmente nulos. Se adopta la regla determinista donde el registro con el `updated_at` más reciente prevalece en el servidor.
