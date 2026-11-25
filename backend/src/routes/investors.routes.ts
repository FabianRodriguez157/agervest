import { Router } from 'express';
import * as InvestorsRepo from '../repositories/investors.repo';
import * as InvestmentsService from '../services/investments.service';
import * as TransactionsRepo from '../repositories/transactions.repo';
import { authRequired, requireRole } from '../middleware/auth';
import { Forbidden, NotFound } from '../lib/errors';

const router = Router();

router.get('/:id', authRequired, async (req, res, next) => {
  try {
    if (req.auth!.sub !== req.params.id && req.auth!.role !== 'admin') throw Forbidden('Solo puedes consultar tu propio perfil');
    const investor = await InvestorsRepo.findById(req.params.id);
    if (!investor) throw NotFound('Investor not found');
    res.json(investor);
  } catch (e) { next(e); }
});

router.get('/:id/portfolio', authRequired, requireRole('investor'), async (req, res, next) => {
  try {
    if (req.auth!.sub !== req.params.id) throw Forbidden('No puedes acceder al portafolio de otro inversionista');
    const [investor, portfolio, pendingReturns, transactions] = await Promise.all([
      InvestorsRepo.findById(req.params.id),
      InvestmentsService.getInvestorPortfolio(req.params.id),
      TransactionsRepo.pendingReturnsForInvestor(req.params.id),
      TransactionsRepo.listForUser(req.params.id),
    ]);
    if (!investor) throw NotFound('Investor not found');
    res.json({ investor, ...portfolio, pendingReturns, transactions });
  } catch (e) { next(e); }
});

export default router;
