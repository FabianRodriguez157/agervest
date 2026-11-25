import { Router } from 'express';
import { z } from 'zod';
import * as InvestmentsService from '../services/investments.service';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();

const investSchema = z.object({
  projectId: z.string().uuid(),
  amount: z.coerce.number().positive(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

router.post('/', authRequired, requireRole('investor'), async (req, res, next) => {
  try {
    const { projectId, amount, idempotencyKey } = investSchema.parse(req.body);
    const key = idempotencyKey ?? (req.header('Idempotency-Key') || undefined);
    const investment = await InvestmentsService.invest(req.auth!.sub, projectId, amount, key);
    res.status(201).json(investment);
  } catch (e) { next(e); }
});

export default router;
