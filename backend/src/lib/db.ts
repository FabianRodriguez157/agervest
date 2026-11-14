import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from './config';

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error', err);
});

/**
 * Invoca una función de PostgreSQL devolviendo filas:
 *   SELECT * FROM fn_name($1, $2, ...)
 * El backend no escribe otras sentencias SQL: toda la lógica vive en la BD.
 */
export async function callFn<T extends QueryResultRow = QueryResultRow>(
  fnName: string,
  args: unknown[] = []
): Promise<T[]> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `SELECT * FROM ${fnName}(${placeholders})`;
  const res: QueryResult<T> = await pool.query<T>(sql, args as any);
  return res.rows;
}

/** Igual que callFn pero devuelve a lo sumo una fila (o null). */
export async function callFnOne<T extends QueryResultRow = QueryResultRow>(
  fnName: string,
  args: unknown[] = []
): Promise<T | null> {
  const rows = await callFn<T>(fnName, args);
  return rows[0] ?? null;
}

/** Para funciones que devuelven un valor escalar. */
export async function callFnScalar<T = unknown>(
  fnName: string,
  args: unknown[] = []
): Promise<T> {
  const rows = await callFn<any>(fnName, args);
  const row = rows[0];
  if (!row) throw new Error(`Function ${fnName} returned no rows`);
  const keys = Object.keys(row);
  return (keys.length === 1 ? row[keys[0]] : row) as T;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
