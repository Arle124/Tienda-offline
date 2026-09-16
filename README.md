# Tienda Offline-First (El Cuaderno Digital)

Sistema integral de gestión de mostrador, ventas, inventario y cuentas por cobrar ("fiados") para tienda de barrio. Diseñado para operar en teléfonos móviles sin conexión constante a internet, con sincronización automática en segundo plano hacia un servidor central en PostgreSQL.

---

## Estructura del Monorepo

```
tienda-offline/
├── apps/
│   ├── mobile/             # React Native + Expo (SQLite / UI mostrador)
│   └── backend/            # Monolito Express / TypeScript + PostgreSQL
├── packages/
│   └── shared/             # Tipos de dominio y contratos del protocolo de sync
├── docker/
│   ├── docker-compose.yml  # PostgreSQL + Backend listo para producción/VPS
│   └── init.sql            # Esquema DDL con UUIDs y soft deletes
└── docs/
    ├── workflows.md        # Los 5 flujos operativos de la tendera
    └── architecture.md     # Especificación de sincronización y datos
```

---

## Requisitos y Comandos Rápidos

- **Node.js**: v22.x
- **pnpm**: 12.x o npm 10.x
- **Docker**: Para levantar PostgreSQL y el Backend

```bash
# Levantar base de datos PostgreSQL local
sudo systemctl start docker
pnpm docker:up

# Iniciar app móvil en modo desarrollo
pnpm mobile

# Iniciar backend en modo desarrollo
pnpm backend
```
