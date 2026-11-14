import { buildApp } from './app';
import { config } from './lib/config';
import { closePool, pool } from './lib/db';

async function main() {
  // Verifica conexión a DB al arrancar
  try {
    await pool.query('SELECT 1');
    console.log('✓ Conectado a PostgreSQL');
  } catch (err) {
    console.error('✗ No se pudo conectar a PostgreSQL:', (err as Error).message);
    process.exit(1);
  }

  const app = buildApp();
  const server = app.listen(config.port, () => {
    console.log(`AgerVest API escuchando en http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\nRecibido ${signal}, cerrando...`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(err => { console.error(err); process.exit(1); });
