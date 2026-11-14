import { Router } from 'express';
import * as AlliesRepo from '../repositories/allies.repo';
import * as FarmersRepo from '../repositories/farmers.repo';
import * as ProjectsRepo from '../repositories/projects.repo';
import * as StatsRepo from '../repositories/stats.repo';
import { authRequired, requireRole } from '../middleware/auth';
import { buildRiskAssessment } from '../services/risk.service';
import { Forbidden, NotFound } from '../lib/errors';

const router = Router();

router.get('/:id/dashboard', authRequired, requireRole('ally'), async (req, res, next) => {
  try {
    if (req.auth!.sub !== req.params.id) throw Forbidden('No puedes acceder al panel de otro aliado');
    const [ally, projects, farmers, counters] = await Promise.all([
      AlliesRepo.findById(req.params.id),
      ProjectsRepo.listAll(),
      FarmersRepo.list(),
      StatsRepo.getAllyDashboardCounters(),
    ]);
    if (!ally) throw NotFound('Ally not found');
    const farmersById = new Map(farmers.map(f => [f.id, f]));
    const queue = projects.map(p => {
      const farmer = farmersById.get(p.farmerId) || null;
      return { project: p, farmer, risk: buildRiskAssessment(p, farmer) };
    });
    res.json({ ally, ...counters, queue });
  } catch (e) { next(e); }
});

export default router;
