import { Router } from 'express';
import { z } from 'zod';
import * as AdminRepo from '../repositories/admin.repo';
import { authRequired, requireRole } from '../middleware/auth';

const router = Router();

router.use(authRequired, requireRole('admin'));

router.get('/metrics', async (_req, res, next) => {
  try {
    res.json(await AdminRepo.getMetrics());
  } catch (e) { next(e); }
});

router.get('/farmers', async (_req, res, next) => {
  try {
    res.json(await AdminRepo.listFarmers());
  } catch (e) { next(e); }
});

const validateSchema = z.object({
  validated: z.boolean(),
  trustScore: z.coerce.number().int().min(0).max(100).optional(),
});

router.post('/farmers/:id/validate', async (req, res, next) => {
  try {
    const data = validateSchema.parse(req.body);
    const farmer = await AdminRepo.setFarmerValidation(req.params.id, data.validated, data.trustScore);
    res.json({ farmer });
  } catch (e) { next(e); }
});

export default router;
