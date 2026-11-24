import { callFn, callFnOne } from '../lib/db';

export interface AdminMetrics {
  totalUsers: number;
  totalFarmers: number;
  totalInvestors: number;
  totalAllies: number;
  validatedFarmers: number;
  pendingFarmers: number;
  totalProjects: number;
  activeProjects: number;
  fundedProjects: number;
  completedProjects: number;
  totalInvested: number;
  totalReturnsPaid: number;
  totalReturnsPending: number;
  overdueReturns: number;
}

export async function getMetrics(): Promise<AdminMetrics> {
  const row = await callFnOne<any>('fn_admin_metrics');
  return {
    totalUsers: Number(row?.total_users ?? 0),
    totalFarmers: Number(row?.total_farmers ?? 0),
    totalInvestors: Number(row?.total_investors ?? 0),
    totalAllies: Number(row?.total_allies ?? 0),
    validatedFarmers: Number(row?.validated_farmers ?? 0),
    pendingFarmers: Number(row?.pending_farmers ?? 0),
    totalProjects: Number(row?.total_projects ?? 0),
    activeProjects: Number(row?.active_projects ?? 0),
    fundedProjects: Number(row?.funded_projects ?? 0),
    completedProjects: Number(row?.completed_projects ?? 0),
    totalInvested: Number(row?.total_invested ?? 0),
    totalReturnsPaid: Number(row?.total_returns_paid ?? 0),
    totalReturnsPending: Number(row?.total_returns_pending ?? 0),
    overdueReturns: Number(row?.overdue_returns ?? 0),
  };
}

export async function listFarmers() {
  const rows = await callFn<any>('fn_admin_list_farmers');
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    location: r.location,
    cropType: r.crop_type,
    yearsExperience: r.years_experience,
    validated: r.validated,
    trustScore: r.trust_score,
    walletBalance: Number(r.wallet_balance ?? 0),
    projectsCount: Number(r.projects_count ?? 0),
    createdAt: r.created_at,
  }));
}

export async function setFarmerValidation(id: string, validated: boolean, trustScore?: number) {
  const row = await callFnOne<any>('fn_admin_set_farmer_validation', [id, validated, trustScore ?? null]);
  return row;
}
