import { callFnOne, callFnScalar } from '../lib/db';

export async function getUsersCount(): Promise<number> {
  return Number(await callFnScalar('fn_users_count'));
}

export interface PlatformStats {
  totalProjects: number; totalFunded: number;
  totalInvestors: number; totalFarmers: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const row = await callFnOne<any>('fn_platform_stats');
  return {
    totalProjects: Number(row?.total_projects ?? 0),
    totalFunded: Number(row?.total_funded ?? 0),
    totalInvestors: Number(row?.total_investors ?? 0),
    totalFarmers: Number(row?.total_farmers ?? 0),
  };
}

export interface FarmerDashboardTotals {
  totalRaised: number; activeProjects: number;
}

export async function getFarmerDashboardTotals(farmerId: string): Promise<FarmerDashboardTotals> {
  const row = await callFnOne<any>('fn_farmer_dashboard_totals', [farmerId]);
  return {
    totalRaised: Number(row?.total_raised ?? 0),
    activeProjects: Number(row?.active_projects ?? 0),
  };
}

export interface AllyDashboardCounters {
  producersSupported: number; campaignsUnderReview: number; publishedCampaigns: number;
}

export async function getAllyDashboardCounters(): Promise<AllyDashboardCounters> {
  const row = await callFnOne<any>('fn_ally_dashboard_counters');
  return {
    producersSupported: Number(row?.producers_supported ?? 0),
    campaignsUnderReview: Number(row?.campaigns_under_review ?? 0),
    publishedCampaigns: Number(row?.published_campaigns ?? 0),
  };
}
