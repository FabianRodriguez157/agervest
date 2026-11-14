import * as ProjectsRepo from '../repositories/projects.repo';
import * as FarmersRepo from '../repositories/farmers.repo';
import * as InvestmentsRepo from '../repositories/investments.repo';
import { BadRequest, NotFound } from '../lib/errors';
import { buildRiskAssessment } from './risk.service';

const CROP_IMAGES: Record<string, string> = {
  quinua: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
  cafe:   'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
  palta:  'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800',
  uva:    'https://images.unsplash.com/photo-1596363505729-4190a9506133?w=800',
  papa:   'https://images.unsplash.com/photo-1552294837-3d3dc1cca8d5?w=800',
};
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800';

export async function createProject(input: ProjectsRepo.CreateProjectInput) {
  // fn_project_create() valida términos y crea proyecto + token atómicamente.
  const imageUrl = input.imageUrl || CROP_IMAGES[input.crop.toLowerCase()] || DEFAULT_IMAGE;
  return ProjectsRepo.create({ ...input, imageUrl });
}

export async function getProjectFull(id: string) {
  const project = await ProjectsRepo.findById(id);
  if (!project) throw NotFound('Project not found');
  const [farmer, token, updates, investorsCount] = await Promise.all([
    FarmersRepo.findById(project.farmerId),
    ProjectsRepo.findTokenByProject(id),
    ProjectsRepo.listUpdates(id),
    InvestmentsRepo.investorsCountForProject(id),
  ]);
  const riskAssessment = buildRiskAssessment(project, farmer);
  return { project, farmer, token, updates, investorsCount, riskAssessment };
}

export async function listWithComputedRisk(filters: ProjectsRepo.ListFilters) {
  const projects = await ProjectsRepo.list(filters);
  const farmerIds = Array.from(new Set(projects.map(p => p.farmerId)));
  const farmers = await Promise.all(farmerIds.map(id => FarmersRepo.findById(id)));
  const byId = new Map(farmers.filter(Boolean).map(f => [f!.id, f!]));
  return projects.map(p => {
    const farmer = byId.get(p.farmerId) || null;
    const { computedRisk, consistent, riskScorePct } = buildRiskAssessment(p, farmer);
    const producerScore = farmer?.trustScore ?? 0;
    const verification = farmer?.validated ? 100 : 60;
    const confidenceIndex = Math.round((producerScore + (100 - riskScorePct) + verification) / 3);
    return { ...p, computedRisk, riskConsistent: consistent, riskScorePct, producerScore,
      verificationCompleteness: verification, confidenceIndex };
  });
}

export async function addUpdate(projectId: string, farmerId: string, data: {
  message: string; progressDelta: number; imageUrl?: string;
}) {
  const project = await ProjectsRepo.findById(projectId);
  if (!project) throw NotFound('Project not found');
  if (project.farmerId !== farmerId)
    throw BadRequest('Solo puedes reportar avances de tus propios proyectos');
  return ProjectsRepo.addUpdate(
    projectId, data.message, Math.max(0, Number(data.progressDelta) || 0), data.imageUrl
  );
}
