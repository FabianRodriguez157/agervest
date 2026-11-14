import fs from 'fs';
import path from 'path';
import { pool, closePool } from './db';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);

    const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
    const { rows } = await client.query<{ version: string }>('SELECT version FROM schema_migrations');
    const applied = new Set(rows.map(r => r.version));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      if (applied.has(version)) {
        console.log(`skip  ${version} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`apply ${version}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
        await client.query('COMMIT');
        console.log(`  ok  ${version}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('migrations complete');
  } finally {
    client.release();
    await closePool();
  }
}

run().catch(err => {
  console.error('migration failed:', err);
  process.exit(1);
});
