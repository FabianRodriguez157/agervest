import { Router } from 'express';
import * as FarmersRepo from '../repositories/farmers.repo';
import * as ProjectsRepo from '../repositories/projects.repo';
import * as StatsRepo from '../repositories/stats.repo';
import * as TransactionsRepo from '../repositories/transactions.repo';
import { authRequired, requireRole } from '../middleware/auth';
import { Forbidden, NotFound } from '../lib/errors';

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await FarmersRepo.list()); } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const farmer = await FarmersRepo.findById(req.params.id);
    if (!farmer) throw NotFound('Farmer not found');
    res.json(farmer);
  } catch (e) { next(e); }
});

router.get('/:id/dashboard', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    if (req.auth!.sub !== req.params.id) throw Forbidden('No puedes acceder al panel de otro agricultor');
    const [farmer, projects, totals, obligations, transactions] = await Promise.all([
      FarmersRepo.findById(req.params.id),
      ProjectsRepo.listByFarmer(req.params.id),
      StatsRepo.getFarmerDashboardTotals(req.params.id),
      TransactionsRepo.pendingObligationsForFarmer(req.params.id),
      TransactionsRepo.listForUser(req.params.id),
    ]);
    if (!farmer) throw NotFound('Farmer not found');
    const projectsWithUpdates = await Promise.all(projects.map(async p => ({
      ...p, updates: await ProjectsRepo.listUpdates(p.id)
    })));
    res.json({
      farmer, projects: projectsWithUpdates, ...totals,
      walletBalance: farmer.walletBalance,
      pendingObligations: obligations,
      transactions,
    });
  } catch (e) { next(e); }
});

export default router;
