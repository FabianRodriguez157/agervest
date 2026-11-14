# AgerVest — Guía de testing

Guía mínima para correr y escribir pruebas del backend.

## Stack

- **vitest** — runner y assertions (`expect`)
- **supertest** — llamadas HTTP contra la app Express sin levantar servidor
- **PostgreSQL de pruebas** — base aislada (ver `.env.test`)

Las pruebas apuntan a una base real porque toda la lógica vive en funciones PL/pgSQL. No mockeamos la BD: sería mockear el 80% del producto.

## Preparar el entorno

```bash
# 1. Levanta Postgres si no está arriba
docker compose up -d

# 2. Crea la base de pruebas (una sola vez)
docker exec -i agervest-postgres psql -U agervest -c "CREATE DATABASE agervest_test;"

# 3. Instala dependencias (ya incluye vitest/supertest)
npm install

# 4. Variables de entorno de testing
cp .env.test.example .env.test
```

## Correr las pruebas

```bash
npm test              # una sola corrida
npm run test:watch    # modo watch
npm run test:coverage # con cobertura (c8/v8)
```

Cada corrida ejecuta `reset → migrate → seed` sobre la base de pruebas (ver `tests/setup.ts`), así los tests siempre empiezan con el mismo estado conocido.

## Qué cubren los tests actuales

| Archivo                       | Qué valida                                                            |
| ----------------------------- | --------------------------------------------------------------------- |
| `tests/auth.test.ts`          | Registro + login + `/me`; contraseñas incorrectas devuelven 401       |
| `tests/projects.test.ts`      | Crear proyecto, listar con filtros, agregar avance                    |
| `tests/invest.test.ts`        | Inversión mueve dinero inversor → agricultor, programa retorno        |
| `tests/returns.test.ts`       | `settle-project` paga los retornos pendientes al inversionista        |
| `tests/risk.service.test.ts`  | Unit test puro: cálculo de riesgo ponderado por los 7 factores        |

## Convenciones

- Un `describe` por recurso (`auth`, `projects`, `wallet`...).
- Los tests crean sus propios usuarios/proyectos; no dependen del seed más allá del estado inicial.
- Para login programático: `agent.post('/api/auth/login').send({...})` — la cookie `agv_session` queda en el agente para las siguientes llamadas.
- Los montos se comparan como números (`Number(x)`) por si Postgres los serializa como string.

## Añadir un test nuevo

1. Crea `tests/<recurso>.test.ts`.
2. Importa el helper: `import { app, loginAs } from './setup';`
3. Usa `request(app)` o `const agent = request.agent(app)` si necesitas cookie.

Ejemplo:

```ts
import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from './setup';

describe('GET /api/stats', () => {
  it('devuelve contadores de la plataforma', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalProjects');
    expect(res.body.totalFarmers).toBeGreaterThan(0);
  });
});
```

## Sobre funciones PL/pgSQL

Las funciones de la BD se prueban **indirectamente** a través de los endpoints: si `fn_invest` falla, el POST a `/api/investments` también. Si quieres probar una función aislada, usa `pool.query('SELECT * FROM fn_x($1)', [arg])` en un test — solo permitido dentro de `tests/` (es código de prueba, no de negocio).

## Qué NO cubren (gaps conocidos)

- Carrera entre dos inversiones concurrentes sobre el mismo proyecto (requiere pool de 2 clientes). El guard SQL ya lo previene, pero no está testeado end-to-end.
- Flujo frontend (requiere Playwright o similar; fuera del alcance de este archivo).
- Rate limiting en `/api/auth/*` (aún no implementado).
