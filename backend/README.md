# AgerVest Backend (PostgreSQL)

API REST en Node.js + TypeScript + Express con PostgreSQL. Reemplaza el almacenamiento en memoria del prototipo v0.9.

## Stack

- Node.js 18+ / TypeScript 5
- Express 4
- PostgreSQL 16 (driver `pg`)
- Autenticación: JWT en cookie `HttpOnly` + Authorization Bearer
- Hash de contraseñas: `bcryptjs`
- Validación: `zod`
- **Toda la lógica SQL vive en la base de datos**: vistas y funciones PL/pgSQL. El backend TypeScript no contiene sentencias SQL — solo invoca `SELECT * FROM fn_xxx(...)` a través de un wrapper (`callFn`, `callFnOne`, `callFnScalar`)
- Transacciones atómicas para inversiones (saldo, token circulante, monto recaudado) ejecutadas dentro de la función `fn_invest()` con `FOR UPDATE` para prevenir carreras

## Puesta en marcha

### 1. Base de datos (Docker)

```bash
docker compose up -d
```

Esto levanta PostgreSQL 16 en `localhost:5432`, usuario `agervest` / password `agervest` / db `agervest`.

### 2. Dependencias y configuración

```bash
cp .env.example .env
npm install
```

Edita `.env` y cambia `JWT_SECRET` por un valor largo y aleatorio.

### 3. Migraciones y datos de ejemplo

```bash
npm run db:migrate   # aplica db/migrations/*.sql
npm run db:seed      # crea 4 agricultores, 4 proyectos, 1 aliado, 2 inversionistas + inversiones
```

Reset completo: `npm run db:reset && npm run db:migrate && npm run db:seed`.

### 4. Arrancar

```bash
npm run dev          # desarrollo (ts-node)
# o
npm run build && npm start
```

API en `http://localhost:3000`. Si existe la carpeta `../public/` del prototipo, el backend sirve el frontend estático en la raíz.

## Credenciales de demo

| Rol         | Email                           | Password  |
| ----------- | ------------------------------- | --------- |
| Agricultor  | `rosa.quispe@agervest.pe`       | `demo123` |
| Agricultor  | `julio.ttito@agervest.pe`       | `demo123` |
| Inversor    | `daniela.fernandez@mail.com`    | `demo123` |
| Inversor    | `carlos.medina@mail.com`        | `demo123` |
| Aliado      | `aliado@agervest.pe`            | `Demo1234`|

## API

Todas las rutas bajo `/api`. Respuestas JSON. Errores con `{ error: string, details?: unknown }`.

### Autenticación

| Método | Ruta                             | Descripción                        |
| ------ | -------------------------------- | ---------------------------------- |
| POST   | `/api/auth/register-farmer`      | Registro de agricultor + login     |
| POST   | `/api/auth/register-investor`    | Registro de inversionista + login  |
| POST   | `/api/auth/register-ally`        | Registro de aliado + login         |
| POST   | `/api/auth/login`                | `{ email, password, role }`        |
| POST   | `/api/auth/logout`               | Limpia cookie de sesión            |
| GET    | `/api/auth/me`                   | Perfil del usuario autenticado     |
| POST   | `/api/auth/investor/verify`      | Verifica inversionista (demo)      |

### Datos

| Método | Ruta                                      | Auth                 |
| ------ | ----------------------------------------- | -------------------- |
| GET    | `/api/stats`                              | pública              |
| GET    | `/api/farmers`                            | pública              |
| GET    | `/api/farmers/:id`                        | pública              |
| GET    | `/api/farmers/:id/dashboard`              | farmer propio        |
| POST   | `/api/projects`                           | farmer               |
| GET    | `/api/projects?crop=&risk=&status=&q=`    | pública              |
| GET    | `/api/projects/:id`                       | pública (full view)  |
| POST   | `/api/projects/:id/updates`               | farmer dueño         |
| GET    | `/api/projects/:id/updates`               | pública              |
| GET    | `/api/investors/:id`                      | pública (demo)       |
| GET    | `/api/investors/:id/portfolio`            | investor propio      |
| POST   | `/api/investments`                        | investor verificado  |
| GET    | `/api/allies/:id/dashboard`               | ally propio          |
| GET    | `/api/wallet/transactions`                | usuario autenticado  |
| GET    | `/api/wallet/pending-returns`             | investor             |
| GET    | `/api/wallet/pending-obligations`         | farmer               |
| POST   | `/api/wallet/pay-return`                  | farmer/ally          |
| POST   | `/api/wallet/process-due-returns`         | ally/admin           |
| POST   | `/api/wallet/settle-project/:projectId`   | ally/admin           |

### Autenticación en el cliente

El backend acepta el JWT por **cookie** (`agv_session`, enviada automáticamente) **o** por header `Authorization: Bearer <token>`. El cuerpo de login/registro devuelve `{ user, token }` por si se prefiere SPA sin cookies.

## Estructura

```
backend/
├── db/
│   └── migrations/
│       ├── 001_init.sql                        # tablas, enums, índices base
│       ├── 002_views_and_functions.sql         # vistas + funciones PL/pgSQL
│       └── 003_wallets_and_transactions.sql    # wallet agricultor + ledger + retornos
├── src/
│   ├── app.ts                 # ensamblado de Express
│   ├── server.ts              # entrypoint (arranque + shutdown)
│   ├── types.ts               # tipos del dominio
│   ├── lib/
│   │   ├── config.ts          # variables de entorno
│   │   ├── db.ts              # pool pg + withTransaction
│   │   ├── migrate.ts         # runner de migraciones
│   │   ├── reset.ts           # drop del esquema (dev)
│   │   ├── seed.ts            # datos de ejemplo
│   │   ├── password.ts        # bcrypt wrappers
│   │   ├── jwt.ts             # firma/verificación JWT
│   │   └── errors.ts          # HttpError + helpers
│   ├── middleware/
│   │   ├── auth.ts            # authOptional, authRequired, requireRole
│   │   └── errorHandler.ts    # mapeo centralizado de errores
│   ├── repositories/          # acceso a datos (uno por tabla)
│   │   ├── farmers.repo.ts
│   │   ├── investors.repo.ts
│   │   ├── allies.repo.ts
│   │   ├── projects.repo.ts
│   │   └── investments.repo.ts
│   ├── services/              # lógica de negocio
│   │   ├── risk.service.ts
│   │   ├── projects.service.ts
│   │   ├── investments.service.ts
│   │   └── stats.service.ts
│   └── routes/                # routers por recurso
│       ├── auth.routes.ts
│       ├── farmers.routes.ts
│       ├── projects.routes.ts
│       ├── investors.routes.ts
│       ├── investments.routes.ts
│       ├── allies.routes.ts
│       └── stats.routes.ts
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── .env.example
```

## Modelo de datos

- `users` — tabla base con `id`, `email`, `password_hash`, `role` (`farmer | investor | ally | admin`).
- `farmers`, `investors`, `allies` — perfiles 1:1 con `users` por `user_id`.
- `projects` — proyectos agrícolas, FK a `farmers.user_id`, con checks que impiden `amount_raised > investment_needed`.
- `tokens` — 1:1 con `projects` (símbolo, supply, precio, circulante).
- `investments` — N:M entre `investors` y `projects` con monto, tokens y retorno esperado.
- `project_updates` — bitácora cronológica por proyecto.
- `sessions` — sesiones persistentes (opcional; JWT es el camino primario).
- `schema_migrations` — control de migraciones.

Enums fuertes para `project_risk`, `project_status`, `risk_profile`, métodos de pago, certificación, etc.

## Billeteras reales y retornos programados

Cada rol tiene su billetera (`investors.wallet_balance`, `farmers.wallet_balance`). Al invertir, el dinero **cambia de billetera realmente**: baja del inversor y sube al agricultor dentro de la misma transacción. El retorno (capital + ganancia) queda registrado en `wallet_transactions` con estado `pending` y una fecha `scheduled_for = NOW() + duration_months`.

Cuando esa fecha se cumple:
- Un endpoint `POST /api/wallet/process-due-returns` (ejecutable por aliado/admin, o por un cron) invoca `fn_process_due_returns()` que recorre todas las transacciones `pending` ya vencidas y las paga una por una.
- `POST /api/wallet/settle-project/:projectId` fuerza el pago inmediato de todos los retornos pendientes de un proyecto (modo demo).
- Si el agricultor no tiene saldo suficiente, la transacción se queda `pending` y se vuelve a intentar en la siguiente corrida.

Cada movimiento aparece en los dashboards:
- **Agricultor**: KPI "Saldo billetera", tabla "Retornos pendientes de pago" (con fecha y días restantes), tabla "Movimientos de billetera".
- **Inversionista**: KPI "Saldo disponible", tabla "Retornos esperados" (fecha estimada, días restantes), tabla "Historial de movimientos".

## Consistencia de inversión

`POST /api/investments` llama a `fn_invest(investor_id, project_id, amount)` que ejecuta en PL/pgSQL dentro de una sola transacción:

1. Toma `FOR UPDATE` del proyecto y del token (previene carreras).
2. Verifica inversionista verificado + saldo suficiente.
3. `UPDATE projects` con guard `amount_raised + p_amount <= investment_needed` (previene sobre-financiamiento concurrente) + cambio automático a `funded` cuando se alcanza el objetivo.
4. Descuenta saldo de la billetera.
5. Incrementa `tokens.circulating`.
6. Inserta en `investments` y devuelve la fila.

Cualquier `RAISE EXCEPTION` dentro de la función revierte toda la transacción. El código TypeScript solo invoca la función y mapea la fila resultante.

## Arquitectura de datos: cero SQL en el código

Todas las lecturas y escrituras pasan por funciones PostgreSQL definidas en [db/migrations/002_views_and_functions.sql](db/migrations/002_views_and_functions.sql).

**Vistas** (perfiles unidos a `users`):
- `v_farmer`, `v_investor`, `v_ally`

**Funciones principales**:

| Dominio    | Funciones                                                                 |
| ---------- | ------------------------------------------------------------------------- |
| Farmers    | `fn_farmer_get`, `fn_farmer_list`, `fn_farmer_auth_by_email`, `fn_farmer_create`, `fn_farmer_mark_validated` |
| Investors  | `fn_investor_get`, `fn_investor_auth_by_email`, `fn_investor_create`, `fn_investor_verify` |
| Allies     | `fn_ally_get`, `fn_ally_auth_by_email`, `fn_ally_create`                  |
| Projects   | `fn_project_get`, `fn_project_list`, `fn_project_list_all`, `fn_project_list_by_farmer`, `fn_project_create`, `fn_project_set_featured`, `fn_project_add_update`, `fn_project_updates`, `fn_token_by_project` |
| Inversión  | `fn_invest`, `fn_investments_by_investor`, `fn_investments_by_project`, `fn_investors_count_for_project` |
| Billetera  | `fn_pay_investment_return`, `fn_process_due_returns`, `fn_settle_project`, `fn_wallet_transactions_for_user`, `fn_pending_returns_for_investor`, `fn_pending_obligations_for_farmer` |
| Métricas   | `fn_platform_stats`, `fn_farmer_dashboard_totals`, `fn_investor_portfolio_totals`, `fn_ally_dashboard_counters`, `fn_users_count` |

El wrapper `callFn(fnName, args)` en [src/lib/db.ts](src/lib/db.ts) genera `SELECT * FROM <fn>($1, $2, ...)` y pasa los parámetros al driver `pg`. Los repositorios de [src/repositories/](src/repositories/) son adaptadores sin lógica propia.

**Índices** sobre `users(LOWER(email))`, `projects(LOWER(crop))`, `projects(LOWER(title))`, `projects(LOWER(location))`, `projects(status, featured)`, `projects(featured) WHERE featured`, `investments(investor_id)`, `investments(project_id)`, `investments(investor_id, project_id)`, `project_updates(project_id, created_at DESC)` — todos para acelerar las consultas que ejecutan las funciones.

## Siguientes pasos sugeridos

- Rate limiting (`express-rate-limit`) en `/api/auth/*`.
- Logs estructurados (`pino`).
- Migración 002 para campos adicionales según evolucione el producto.
- Tests con `vitest`/`supertest` sobre el flujo de inversión.
- Separar `walletBalance` en una tabla `wallet_transactions` para auditoría.
