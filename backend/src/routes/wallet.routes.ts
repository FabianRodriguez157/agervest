import { Router } from 'express';
import { z } from 'zod';
import * as TransactionsRepo from '../repositories/transactions.repo';
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
    const tx = await TransactionsRepo.payReturn(transactionId);
    if (!tx) throw BadRequest('No se pudo liquidar la transacción');
    res.json(tx);
  } catch (e) { next(e); }
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

export default router;
