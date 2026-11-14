import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload, UserRole } from '../lib/jwt';
import { config } from '../lib/config';
import { Unauthorized, Forbidden } from '../lib/errors';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookie = (req as any).cookies?.[config.cookieName];
  return cookie || null;
}

export function authOptional(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next();
  try { req.auth = verifyToken(token); } catch { /* ignore */ }
  next();
}

export function authRequired(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(Unauthorized('Debes iniciar sesión'));
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    next(Unauthorized('Sesión inválida o expirada'));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(Unauthorized());
    if (!roles.includes(req.auth.role)) return next(Forbidden('No tienes permisos para esta operación'));
    next();
  };
}
