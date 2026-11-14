import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

function req(key: string, fallback?: string): string {
  const v = process.env[key] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${key}`);
  return v;
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  databaseUrl: req('DATABASE_URL', 'postgresql://agervest:agervest@localhost:5432/agervest'),
  jwtSecret: req('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'agv_session',
  cookieSameSite: (process.env.COOKIE_SAMESITE || 'lax').toLowerCase() as 'lax' | 'strict' | 'none',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 10),
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  isProd: process.env.NODE_ENV === 'production',
};
