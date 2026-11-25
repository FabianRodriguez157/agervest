import { Router } from 'express';
import { z } from 'zod';
import * as FarmersRepo from '../repositories/farmers.repo';
import * as InvestorsRepo from '../repositories/investors.repo';
import * as AlliesRepo from '../repositories/allies.repo';
import * as AdminsRepo from '../repositories/admins.repo';
import { hashPassword, verifyPassword } from '../lib/password';
import { signToken, UserRole } from '../lib/jwt';
import { config } from '../lib/config';
import { callFnOne } from '../lib/db';
import { authRequired } from '../middleware/auth';
import { BadRequest, Unauthorized, NotFound } from '../lib/errors';

const router = Router();

function setAuthCookie(res: any, token: string) {
  const sameSite = config.cookieSameSite;
  res.cookie(config.cookieName, token, {
    httpOnly: true, path: '/',
    sameSite,
    // SameSite=None requires Secure=true even over HTTP would be rejected
    secure: sameSite === 'none' ? true : config.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

const registerFarmerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().min(5),
  location: z.string().min(2),
  cropType: z.string().min(2),
  areaHa: z.coerce.number().positive(),
  documentId: z.string().min(5),
  documentUrl: z.string().url().optional(),
  yearsExperience: z.coerce.number().int().nonnegative().optional(),
  certifications: z.array(z.string()).optional(),
  bankAccount: z.string().min(5),
  paymentMethod: z.enum(['bank_transfer', 'wallet', 'other']).optional(),
  agriculturalCertified: z.boolean().optional(),
  termsAccepted: z.literal(true),
});

router.post('/register-farmer', async (req, res, next) => {
  try {
    const data = registerFarmerSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const farmer = await FarmersRepo.create({ ...data, passwordHash });
    const token = signToken({ sub: farmer.id, role: 'farmer', name: farmer.name });
    setAuthCookie(res, token);
    res.status(201).json({ user: farmer, token });
  } catch (e) { next(e); }
});

const registerInvestorSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  country: z.string().optional(),
  documentId: z.string().optional(),
  documentIdType: z.enum(['DNI','CE','PASSPORT']).optional(),
  occupation: z.string().optional(),
  investmentExperience: z.enum(['none','basic','intermediate','advanced']).optional(),
  investmentFrequency: z.enum(['monthly','quarterly','annual','sporadic']).optional(),
  investmentBudget: z.coerce.number().nonnegative().optional(),
  riskProfile: z.enum(['conservador','moderado','agresivo']).optional(),
  bankAccount: z.string().optional(),
  paymentMethod: z.enum(['bank_transfer','wallet','credit_card']).optional(),
  termsAccepted: z.literal(true),
  riskAcknowledgment: z.literal(true),
});

router.post('/register-investor', async (req, res, next) => {
  try {
    const data = registerInvestorSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const investor = await InvestorsRepo.create({ ...data, passwordHash });
    const token = signToken({ sub: investor.id, role: 'investor', name: investor.name });
    setAuthCookie(res, token);
    res.status(201).json({ user: investor, token });
  } catch (e) { next(e); }
});

const registerAllySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  country: z.string().optional(),
  organization: z.string().min(2),
  roleDescription: z.string().optional(),
  termsAccepted: z.literal(true),
});

router.post('/register-ally', async (req, res, next) => {
  try {
    const data = registerAllySchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);
    const ally = await AlliesRepo.create({ ...data, passwordHash });
    const token = signToken({ sub: ally.id, role: 'ally', name: ally.name });
    setAuthCookie(res, token);
    res.status(201).json({ user: ally, token });
  } catch (e) { next(e); }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(['farmer', 'investor', 'ally', 'admin']),
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, role } = loginSchema.parse(req.body);
    let user: any;
    if (role === 'farmer')        user = await FarmersRepo.findByEmail(email);
    else if (role === 'investor') user = await InvestorsRepo.findByEmail(email);
    else if (role === 'ally')     user = await AlliesRepo.findByEmail(email);
    else                           user = await AdminsRepo.findByEmail(email);
    if (!user) throw Unauthorized('Credenciales inválidas');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw Unauthorized('Credenciales inválidas');
    const { passwordHash: _, ...safe } = user;
    const token = signToken({ sub: user.id, role: role as UserRole, name: user.name });
    setAuthCookie(res, token);
    res.json({ role, user: safe, token });
  } catch (e) { next(e); }
});

router.post('/logout', (_req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const { sub, role } = req.auth!;
    let user: any;
    if (role === 'farmer')        user = await FarmersRepo.findById(sub);
    else if (role === 'investor') user = await InvestorsRepo.findById(sub);
    else if (role === 'ally')     user = await AlliesRepo.findById(sub);
    else if (role === 'admin')    user = await AdminsRepo.findById(sub);
    if (!user) throw NotFound('Usuario no encontrado');
    // Enriquecer con estado de verificación
    const vrow = await callFnOne<any>('fn_get_verification_state', [sub]);
    if (vrow) {
      user.verified = vrow.verified;
      user.verificationRequestedAt = vrow.verification_requested_at;
      user.verificationDecidedAt = vrow.verification_decided_at;
    }
    res.json({ role, user });
  } catch (e) { next(e); }
});

const verifySchema = z.object({
  documentId: z.string().optional(),
  phone: z.string().optional(),
  bankAccount: z.string().optional(),
});

router.post('/investor/verify', authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role !== 'investor') throw BadRequest('Solo inversionistas pueden verificarse aquí');
    const data = verifySchema.parse(req.body);
    const investor = await InvestorsRepo.verify(req.auth!.sub, data);
    res.json({ user: investor, verified: true, demo: true });
  } catch (e) { next(e); }
});

router.post('/request-verification', authRequired, async (req, res, next) => {
  try {
    if (req.auth!.role === 'admin') throw BadRequest('El administrador no requiere verificación');
    const row = await callFnOne<any>('fn_request_verification', [req.auth!.sub]);
    if (!row) throw NotFound('Usuario no encontrado');
    res.json({
      verified: row.verified,
      verificationRequestedAt: row.verification_requested_at,
    });
  } catch (e) { next(e); }
});

export default router;
