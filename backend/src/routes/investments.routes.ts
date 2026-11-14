import { Router } from 'express';
import { z } from 'zod';
import * as InvestmentsService from '../services/investments.service';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();

const investSchema = z.object({
  projectId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

router.post('/', authRequired, requireRole('investor'), async (req, res, next) => {
  try {
    const { projectId, amount } = investSchema.parse(req.body);
    const investment = await InvestmentsService.invest(req.auth!.sub, projectId, amount);
    res.status(201).json(investment);
  } catch (e) { next(e); }
});

export default router;
