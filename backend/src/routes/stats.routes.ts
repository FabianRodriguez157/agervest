import { Router } from 'express';
import { getPlatformStats } from '../services/stats.service';

const router = Router();

router.get('/', async (_req, res, next) => {
  try { res.json(await getPlatformStats()); } catch (e) { next(e); }
});

export default router;
