import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from './config';

export type UserRole = 'farmer' | 'investor' | 'ally' | 'admin';

export interface JwtPayload {
  sub: string;        // user id
  role: UserRole;
  name: string;
}

export function signToken(payload: JwtPayload): string {
  const opts: SignOptions = { expiresIn: config.jwtExpiresIn as any };
  return jwt.sign(payload, config.jwtSecret, opts);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}
