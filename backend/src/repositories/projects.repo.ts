import { callFn, callFnOne } from '../lib/db';
import { Project, ProjectUpdate, Token } from '../types';

function mapProject(r: any): Project {
  return {
    id: r.id, farmerId: r.farmer_id, title: r.title, crop: r.crop,
    description: r.description, location: r.location,
    projectAreaHa: Number(r.project_area_ha), cropVariety: r.crop_variety,
    investmentNeeded: Number(r.investment_needed),
    amountRaised: Number(r.amount_raised), amountAvailable: Number(r.amount_available),
    durationMonths: r.duration_months, risk: r.risk,
    expectedReturnPct: Number(r.expected_return_pct), paymentMethod: r.payment_method,
    objectives: r.objectives, benefits: r.benefits, riskMitigation: r.risk_mitigation,
    hasInsurance: r.has_insurance, priorExperience: r.prior_experience,
    certification: r.certification, technicalSupport: r.technical_support,
    imageUrl: r.image_url, documentUrl: r.document_url,
    status: r.status, progress: r.progress, featured: r.featured,
    termsAccepted: r.terms_accepted, updatesAccepted: r.updates_accepted,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapToken(r: any): Token {
  return {
    id: r.id, projectId: r.project_id, symbol: r.symbol,
    totalSupply: Number(r.total_supply), price: Number(r.price),
    circulating: Number(r.circulating),
  };
}

function mapUpdate(r: any): ProjectUpdate {
  return {
    id: r.id, projectId: r.project_id, message: r.message,
    progressDelta: r.progress_delta, imageUrl: r.image_url, createdAt: r.created_at,
  };
}

export async function findById(id: string): Promise<Project | null> {
  const row = await callFnOne('fn_project_get', [id]);
  return row ? mapProject(row) : null;
}

export async function listAll(): Promise<Project[]> {
  const rows = await callFn('fn_project_list_all');
  return rows.map(mapProject);
}

export async function listByFarmer(farmerId: string): Promise<Project[]> {
  const rows = await callFn('fn_project_list_by_farmer', [farmerId]);
  return rows.map(mapProject);
}

export interface ListFilters {
  crop?: string; risk?: string; status?: string; q?: string;
}

export async function list(filters: ListFilters = {}): Promise<Project[]> {
  const rows = await callFn('fn_project_list', [
    filters.crop ?? null, filters.risk ?? null,
    filters.status ?? null, filters.q ?? null,
  ]);
  return rows.map(mapProject);
}

export interface CreateProjectInput {
  farmerId: string; title: string; crop: string; description: string;
  location: string; projectAreaHa: number; cropVariety: string;
  investmentNeeded: number; amountAvailable?: number; durationMonths: number;
  risk: 'bajo' | 'medio' | 'alto'; expectedReturnPct: number;
  paymentMethod?: 'percentage' | 'fixed' | 'monthly' | 'harvest';
  objectives: string; benefits: string; riskMitigation: string;
  hasInsurance?: 'yes' | 'planning' | 'no';
  priorExperience?: 'yes' | 'assisted' | 'new';
  certification?: 'organic' | 'conventional' | 'in_transition' | 'fair_trade' | 'other';
  technicalSupport?: 'own_experience' | 'contractor' | 'government' | 'agro_company' | 'other';
  imageUrl?: string; documentUrl?: string;
  termsAccepted: boolean; updatesAccepted: boolean;
  featured?: boolean;
}

export async function create(input: CreateProjectInput): Promise<Project> {
  const row = await callFnOne('fn_project_create', [
    input.farmerId, input.title, input.crop, input.description, input.location,
    input.projectAreaHa, input.cropVariety, input.investmentNeeded,
    input.amountAvailable ?? null, input.durationMonths, input.risk, input.expectedReturnPct,
    input.paymentMethod ?? null, input.objectives, input.benefits, input.riskMitigation,
    input.hasInsurance ?? null, input.priorExperience ?? null,
    input.certification ?? null, input.technicalSupport ?? null,
    input.imageUrl ?? null, input.documentUrl ?? null,
    input.featured ?? null, input.termsAccepted, input.updatesAccepted,
  ]);
  if (!row) throw new Error('Project insert failed');
  return mapProject(row);
}

export async function setFeatured(id: string, featured: boolean): Promise<Project | null> {
  const row = await callFnOne('fn_project_set_featured', [id, featured]);
  return row ? mapProject(row) : null;
}

export async function findTokenByProject(projectId: string): Promise<Token | null> {
  const row = await callFnOne('fn_token_by_project', [projectId]);
  return row ? mapToken(row) : null;
}

export async function listUpdates(projectId: string): Promise<ProjectUpdate[]> {
  const rows = await callFn('fn_project_updates', [projectId]);
  return rows.map(mapUpdate);
}

export async function addUpdate(
  projectId: string, message: string, progressDelta: number, imageUrl?: string
): Promise<ProjectUpdate> {
  const row = await callFnOne('fn_project_add_update', [projectId, message, progressDelta, imageUrl ?? null]);
  if (!row) throw new Error('Update insert failed');
  return mapUpdate(row);
}
