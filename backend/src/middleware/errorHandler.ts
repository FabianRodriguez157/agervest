import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Datos inválidos', details: err.flatten() });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Postgres unique violation
  if ((err as any)?.code === '23505') {
    return res.status(409).json({ error: 'Ya existe un registro con esos datos' });
  }
  console.error('Unhandled error:', err);
  const message = err instanceof Error ? err.message : 'Error interno';
  res.status(500).json({ error: message });
}
