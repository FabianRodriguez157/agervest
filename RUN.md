# AgerVest — Guía rápida para correr el proyecto y los tests

Este documento explica cómo levantar la app y cómo ejecutar las pruebas. Si recibiste el proyecto en dos zips (`agervest-project.zip` y `agervest-tests.zip`), descomprime el primero y copia la carpeta `backend/tests/` del segundo dentro de `backend/` del primero antes de empezar.

```
agervest-mejorado/            ← contenido de agervest-project.zip
├── backend/
│   ├── db/
│   ├── src/
│   ├── tests/                ← contenido de agervest-tests.zip (copiar aquí)
│   ├── docker-compose.yml
│   ├── package.json
│   ├── TESTING.md
│   ├── vitest.config.ts
│   ├── .env.example
│   └── .env.test.example
└── public/                   ← frontend estático
```

## Requisitos

- Node.js 18 o superior
- Docker Desktop (o un PostgreSQL 16 local)
- Puerto 3000 (API + frontend) y 5432 (Postgres) libres

## 1. Levantar la base de datos

Desde la carpeta `backend/`:

```bash
docker compose up -d
```

Esto arranca PostgreSQL 16 en `localhost:5432` con usuario `agervest`, password `agervest` y base `agervest`. Para parar: `docker compose down` (los datos quedan guardados en el volumen `agervest_pgdata`).

## 2. Instalar dependencias y variables de entorno

```bash
cd backend
cp .env.example .env
npm install
```

Edita `.env` y cambia `JWT_SECRET` por una cadena larga aleatoria antes de usar en algo que no sea desarrollo local.

## 3. Migrar y sembrar datos

```bash
npm run db:migrate   # crea tablas, enums, vistas y funciones
npm run db:seed      # 4 agricultores, 5 proyectos, 1 aliado, 2 inversionistas + inversiones
```

Si quieres empezar de cero: `npm run db:reset && npm run db:migrate && npm run db:seed`.

## 4. Arrancar la aplicación

```bash
npm run dev          # desarrollo con recarga (ts-node)
# o para producción:
npm run build && npm start
```

Abre [http://localhost:3000](http://localhost:3000). El backend sirve además el frontend estático de `public/` desde la misma URL.

## 5. Credenciales de demo

| Rol         | Email                           | Password   |
| ----------- | ------------------------------- | ---------- |
| Agricultor  | `rosa.quispe@agervest.pe`       | `demo123`  |
| Agricultor  | `julio.ttito@agervest.pe`       | `demo123`  |
| Inversor    | `daniela.fernandez@mail.com`    | `demo123`  |
| Inversor    | `carlos.medina@mail.com`        | `demo123`  |
| Aliado      | `aliado@agervest.pe`            | `Demo1234` |

Para ver el flujo completo:

1. Entra como `carlos.medina@mail.com` → panel inversionista → verás un retorno ya cobrado del proyecto demo cerrado y otros pendientes.
2. Entra como `rosa.quispe@agervest.pe` → panel agricultor → verás saldo en billetera recibido de las inversiones.
3. Entra como `aliado@agervest.pe` → desde Postman o `curl` llama `POST /api/wallet/settle-project/<id>` para forzar el pago de retornos.

## 6. Correr los tests

Primero crea la base de datos de pruebas (una vez):

```bash
docker exec -i agervest-postgres psql -U agervest -c "CREATE DATABASE agervest_test;"
```

Luego:

```bash
cp .env.test.example .env.test
npm test                 # una corrida
npm run test:watch       # modo watch
npm run test:coverage    # con cobertura
```

Cada corrida resetea el schema de la base de pruebas antes de empezar — tus datos de desarrollo en `agervest` no se tocan.

Las suites cubren:

- `auth.test.ts` — registro, login, email duplicado, `/me`
- `projects.test.ts` — crear proyecto autenticado, filtros, updates
- `invest.test.ts` — dinero real moviéndose inversor → agricultor + retorno programado
- `returns.test.ts` — `settle-project` paga retornos pendientes
- `risk.service.test.ts` — unit test puro del score de riesgo

Detalles y convenciones de testing en [backend/TESTING.md](backend/TESTING.md).

## Problemas comunes

| Síntoma                                          | Solución                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `ECONNREFUSED localhost:5432`                    | Postgres no está arriba. `docker compose up -d`                     |
| `relation "..." does not exist`                  | Falta correr `npm run db:migrate`                                   |
| Tests fallan con `database "agervest_test" does not exist` | Crea la base con el `docker exec` del paso 6                 |
| El frontend muestra "No se pudo cargar"          | Revisa la consola del navegador y los logs de `npm run dev`         |
| Email duplicado al re-sembrar                    | El seed es idempotente; usa `npm run db:reset` si quieres rehacerlo |

## Estructura de referencia

- `backend/db/migrations/001_init.sql` — tablas, enums, índices base
- `backend/db/migrations/002_views_and_functions.sql` — vistas + funciones PL/pgSQL
- `backend/db/migrations/003_wallets_and_transactions.sql` — billeteras y libro mayor
- `backend/src/app.ts` — ensamblado de Express
- `backend/src/routes/` — un router por recurso (`auth`, `projects`, `wallet`...)
- `backend/src/repositories/` — adaptadores que invocan funciones de Postgres (`callFn`)
- `backend/src/services/` — lógica que no vive en la BD (risk score, orquestación)
- `backend/README.md` — detalle completo del backend
