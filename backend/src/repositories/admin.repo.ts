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

export async function listPendingVerifications() {
  const rows = await callFn<any>('fn_admin_list_pending_verifications');
  return rows.map(r => ({
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    phone: r.phone,
    verificationRequestedAt: r.verification_requested_at,
    createdAt: r.created_at,
  }));
}

export async function approveVerification(userId: string, notes?: string) {
  const row = await callFnOne<any>('fn_admin_approve_verification', [userId, notes ?? null]);
  return { id: row.id, verified: row.verified, verificationDecidedAt: row.verification_decided_at };
}

export async function rejectVerification(userId: string, notes?: string) {
  const row = await callFnOne<any>('fn_admin_reject_verification', [userId, notes ?? null]);
  return { id: row.id, verified: row.verified, verificationDecidedAt: row.verification_decided_at };
}

export interface EarningsSummary {
  totalInvestments: number;
  totalGross: number;
  totalCommission: number;
  totalNetToFarmers: number;
  averageCommission: number;
  commissionRate: number;
}

export async function earningsSummary(): Promise<EarningsSummary> {
  const row = await callFnOne<any>('fn_admin_earnings_summary');
  return {
    totalInvestments: Number(row?.total_investments ?? 0),
    totalGross: Number(row?.total_gross ?? 0),
    totalCommission: Number(row?.total_commission ?? 0),
    totalNetToFarmers: Number(row?.total_net_to_farmers ?? 0),
    averageCommission: Number(row?.average_commission ?? 0),
    commissionRate: Number(row?.commission_rate ?? 0.06),
  };
}

export async function earningsList() {
  const rows = await callFn<any>('fn_admin_earnings_list');
  return rows.map(r => ({
    id: r.id,
    investmentId: r.investment_id,
    projectId: r.project_id,
    projectTitle: r.project_title,
    projectCrop: r.project_crop,
    investorId: r.investor_id,
    investorName: r.investor_name,
    farmerId: r.farmer_id,
    farmerName: r.farmer_name,
    grossAmount: Number(r.gross_amount),
    commission: Number(r.commission),
    netToFarmer: Number(r.net_to_farmer),
    commissionRate: Number(r.commission_rate),
    createdAt: r.created_at,
  }));
}

export async function earningsByProject() {
  const rows = await callFn<any>('fn_admin_earnings_by_project');
  return rows.map(r => ({
    projectId: r.project_id,
    projectTitle: r.project_title,
    projectCrop: r.project_crop,
    investmentsCount: Number(r.investments_count),
    totalGross: Number(r.total_gross),
    totalCommission: Number(r.total_commission),
  }));
}
