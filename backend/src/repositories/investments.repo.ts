import { callFn, callFnOne, callFnScalar } from '../lib/db';
import { Investment } from '../types';

function mapRow(r: any): Investment {
  return {
    id: r.id, investorId: r.investor_id, projectId: r.project_id,
    amount: Number(r.amount), tokensAcquired: Number(r.tokens_acquired),
    expectedReturn: Number(r.expected_return), createdAt: r.created_at,
  };
}

export async function invest(
  investorId: string, projectId: string, amount: number
): Promise<Investment> {
  const row = await callFnOne('fn_invest', [investorId, projectId, amount]);
  if (!row) throw new Error('Investment failed');
  return mapRow(row);
}

export async function listByInvestor(investorId: string): Promise<Investment[]> {
  const rows = await callFn('fn_investments_by_investor', [investorId]);
  return rows.map(mapRow);
}

export async function listByProject(projectId: string): Promise<Investment[]> {
  const rows = await callFn('fn_investments_by_project', [projectId]);
  return rows.map(mapRow);
}

export async function investorsCountForProject(projectId: string): Promise<number> {
  return Number(await callFnScalar('fn_investors_count_for_project', [projectId]));
}

export interface PortfolioTotals {
  totalInvested: number; totalExpectedReturn: number; projectsFunded: number;
}

export async function portfolioTotals(investorId: string): Promise<PortfolioTotals> {
  const row = await callFnOne<any>('fn_investor_portfolio_totals', [investorId]);
  return {
    totalInvested: Number(row?.total_invested ?? 0),
    totalExpectedReturn: Number(row?.total_expected_return ?? 0),
    projectsFunded: Number(row?.projects_funded ?? 0),
  };
}
