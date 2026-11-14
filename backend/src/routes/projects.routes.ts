import { Router } from 'express';
import { z } from 'zod';
import * as ProjectsService from '../services/projects.service';
import * as ProjectsRepo from '../repositories/projects.repo';
import { authRequired, requireRole } from '../middleware/auth';
import { NotFound } from '../lib/errors';

const router = Router();

const createProjectSchema = z.object({
  title: z.string().min(3),
  crop: z.string().min(2),
  description: z.string().min(10),
  location: z.string().min(2),
  projectAreaHa: z.coerce.number().positive(),
  cropVariety: z.string().min(1),
  investmentNeeded: z.coerce.number().positive(),
  amountAvailable: z.coerce.number().nonnegative().optional(),
  durationMonths: z.coerce.number().int().positive(),
  risk: z.enum(['bajo','medio','alto']),
  expectedReturnPct: z.coerce.number().nonnegative(),
  paymentMethod: z.enum(['percentage','fixed','monthly','harvest']).optional(),
  objectives: z.string().min(5),
  benefits: z.string().min(5),
  riskMitigation: z.string().min(5),
  hasInsurance: z.enum(['yes','planning','no']).optional(),
  priorExperience: z.enum(['yes','assisted','new']).optional(),
  certification: z.enum(['organic','conventional','in_transition','fair_trade','other']).optional(),
  technicalSupport: z.enum(['own_experience','contractor','government','agro_company','other']).optional(),
  imageUrl: z.string().url().optional(),
  documentUrl: z.string().url().optional(),
  termsAccepted: z.literal(true),
  updatesAccepted: z.literal(true),
});

router.post('/', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await ProjectsService.createProject({ ...data, farmerId: req.auth!.sub });
    res.status(201).json(project);
  } catch (e) { next(e); }
});

router.get('/', async (req, res, next) => {
  try {
    const { crop, risk, status, q } = req.query;
    const list = await ProjectsService.listWithComputedRisk({
      crop: crop as string | undefined,
      risk: risk as string | undefined,
      status: status as string | undefined,
      q: q as string | undefined,
    });
    res.json(list);
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try { res.json(await ProjectsService.getProjectFull(req.params.id)); }
  catch (e) { next(e); }
});

const updateSchema = z.object({
  message: z.string().min(2),
  progressDelta: z.coerce.number().min(0).max(100).optional(),
  imageUrl: z.string().url().optional(),
});

router.post('/:id/updates', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    const update = await ProjectsService.addUpdate(req.params.id, req.auth!.sub, {
      message: data.message, progressDelta: data.progressDelta ?? 0, imageUrl: data.imageUrl,
    });
    res.status(201).json(update);
  } catch (e) { next(e); }
});

router.get('/:id/updates', async (req, res, next) => {
  try {
    const project = await ProjectsRepo.findById(req.params.id);
    if (!project) throw NotFound('Project not found');
    res.json(await ProjectsRepo.listUpdates(req.params.id));
  } catch (e) { next(e); }
});

export default router;
