import * as ProjectsRepo from '../repositories/projects.repo';
import * as InvestorsRepo from '../repositories/investors.repo';
import * as InvestmentsRepo from '../repositories/investments.repo';
import { NotFound } from '../lib/errors';

/**
 * La transacción completa de inversión (validaciones, descuento de billetera,
 * incremento de token circulante, guard de sobre-financiamiento) vive en la
 * función fn_invest() de PostgreSQL. Aquí solo se delega.
 */
export async function invest(investorId: string, projectId: string, amount: number, idempotencyKey?: string) {
  return InvestmentsRepo.invest(investorId, projectId, amount, idempotencyKey);
}

export async function getInvestorPortfolio(investorId: string) {
  const [investments, totals] = await Promise.all([
    InvestmentsRepo.listByInvestor(investorId),
    InvestmentsRepo.portfolioTotals(investorId),
  ]);
  const projectIds = Array.from(new Set(investments.map(i => i.projectId)));
  const projects = await Promise.all(projectIds.map(id => ProjectsRepo.findById(id)));
  const byId = new Map(projects.filter(Boolean).map(p => [p!.id, p!]));
  const enriched = investments.map(i => ({ ...i, project: byId.get(i.projectId) || null }));
  return { investments: enriched, ...totals };
}
