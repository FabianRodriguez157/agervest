import { pool, closePool } from './db';

async function run() {
  const client = await pool.connect();
  try {
    console.log('Dropping all AgerVest objects (functions, views, tables, types)...');
    await client.query(`
      DO $$
      DECLARE r RECORD;
      BEGIN
        FOR r IN
          SELECT p.proname AS name,
                 pg_get_function_identity_arguments(p.oid) AS args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public' AND p.proname LIKE 'fn\\_%'
        LOOP
          EXECUTE format('DROP FUNCTION IF EXISTS public.%I(%s) CASCADE', r.name, r.args);
        END LOOP;
      END $$;

      DROP VIEW IF EXISTS v_farmer, v_investor, v_ally CASCADE;

      DROP TABLE IF EXISTS project_updates, investments, tokens, projects,
        allies, investors, farmers, sessions, users, schema_migrations CASCADE;

      DROP TYPE IF EXISTS user_role, project_risk, project_status, risk_profile,
        farmer_payment_method, investor_payment_method, project_payment_method,
        insurance_status, prior_experience, certification_type, technical_support,
        investment_experience, investment_frequency, id_document_type CASCADE;
    `);
    console.log('reset complete');
  } finally {
    client.release();
    await closePool();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
