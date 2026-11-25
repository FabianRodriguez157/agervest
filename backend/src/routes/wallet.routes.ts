import { Router } from 'express';
import { z } from 'zod';
import * as TransactionsRepo from '../repositories/transactions.repo';
import { callFnOne } from '../lib/db';
import { authRequired, requireRole } from '../middleware/auth';
import { BadRequest } from '../lib/errors';

const router = Router();

// Todas las transacciones del usuario autenticado (como origen o destino).
router.get('/transactions', authRequired, async (req, res, next) => {
  try { res.json(await TransactionsRepo.listForUser(req.auth!.sub)); }
  catch (e) { next(e); }
});

// Retornos pendientes del inversor
router.get('/pending-returns', authRequired, requireRole('investor'), async (req, res, next) => {
  try { res.json(await TransactionsRepo.pendingReturnsForInvestor(req.auth!.sub)); }
  catch (e) { next(e); }
});

// Obligaciones pendientes del agricultor
router.get('/pending-obligations', authRequired, requireRole('farmer'), async (req, res, next) => {
  try { res.json(await TransactionsRepo.pendingObligationsForFarmer(req.auth!.sub)); }
  catch (e) { next(e); }
});

// Pago manual de un retorno (agricultor pagando antes de la fecha, o aliado)
const paySchema = z.object({ transactionId: z.string().uuid() });
router.post('/pay-return', authRequired, requireRole('farmer', 'ally', 'admin'), async (req, res, next) => {
  try {
    const { transactionId } = paySchema.parse(req.body);
    const tx = await TransactionsRepo.payReturn(transactionId, req.auth!.sub, req.auth!.role);
    if (!tx) throw BadRequest('No se pudo liquidar la transacción');
    res.json(tx);
  } catch (e) { next(e); }
});

// Cierra campañas vencidas sin meta completa y reembolsa aportes reservados
router.post('/expire-campaigns', authRequired, requireRole('ally', 'admin'), async (_req, res, next) => {
  try { res.json({ closed: await callFnOne<any>('fn_expire_campaigns', []).then(r => Number(r?.fn_expire_campaigns ?? 0)) }); }
  catch (e) { next(e); }
});

// Procesa todos los retornos vencidos (demo/cron)
router.post('/process-due-returns', authRequired, requireRole('ally', 'admin'), async (_req, res, next) => {
  try { res.json({ paid: await TransactionsRepo.processDueReturns() }); }
  catch (e) { next(e); }
});

// Liquida manualmente un proyecto (demo: fuerza pagos pendientes aunque no venzan)
router.post('/settle-project/:projectId', authRequired, requireRole('ally', 'admin'), async (req, res, next) => {
  try { res.json({ paid: await TransactionsRepo.settleProject(req.params.projectId) }); }
  catch (e) { next(e); }
});

// Depósito simulado (investor/farmer)
const depositSchema = z.object({
  amount: z.coerce.number().positive(),
  bankAccount: z.string().min(5),
  idempotencyKey: z.string().min(8).max(80).optional(),
});
router.post('/deposit', authRequired, async (req, res, next) => {
  try {
    const { amount, bankAccount, idempotencyKey } = depositSchema.parse(req.body);
    const key = idempotencyKey ?? (req.header('Idempotency-Key') || null);
    const row = await callFnOne<any>('fn_wallet_deposit_idem', [req.auth!.sub, amount, bankAccount, key]);
    if (!row) throw BadRequest('No se pudo procesar el depósito');
    res.json({ transactionId: row.tx_id, newBalance: Number(row.new_balance) });
  } catch (e) { next(e); }
});

export default router;
