import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Carga .env.test antes de importar la app
dotenv.config({ path: path.join(__dirname, '..', '.env.test') });

// Importa dinámicamente para que `config` lea el .env.test
import { buildApp } from '../src/app';
import { pool, closePool } from '../src/lib/db';

export const app = buildApp();

async function dropAll() {
  await pool.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT p.proname AS n, pg_get_function_identity_arguments(p.oid) AS a
               FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
               WHERE ns.nspname = 'public' AND p.proname LIKE 'fn\\_%' LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.n, r.a);
      END LOOP;
    END $$;
    DROP VIEW IF EXISTS v_farmer, v_investor, v_ally CASCADE;
    DROP TABLE IF EXISTS wallet_transactions, project_updates, investments, tokens,
      projects, allies, investors, farmers, sessions, users, schema_migrations CASCADE;
    DROP TYPE IF EXISTS user_role, project_risk, project_status, risk_profile,
      farmer_payment_method, investor_payment_method, project_payment_method,
      insurance_status, prior_experience, certification_type, technical_support,
      investment_experience, investment_frequency, id_document_type,
      transaction_type, transaction_status CASCADE;
  `);
}

async function migrate() {
  const dir = path.join(__dirname, '..', 'db', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  for (const f of files) {
    await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
}

beforeAll(async () => {
  await dropAll();
  await migrate();
  // Seeding mínimo via API para no acoplar tests a datos específicos.
});

afterAll(async () => {
  await closePool();
});

/** Helper: devuelve un supertest.agent con cookie de sesión activa. */
export async function loginAs(
  role: 'farmer' | 'investor' | 'ally',
  email: string,
  password: string
) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password, role });
  if (res.status !== 200) throw new Error(`Login falló: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user };
}
