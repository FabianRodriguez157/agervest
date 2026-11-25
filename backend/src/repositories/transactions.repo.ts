import { callFn, callFnOne, callFnScalar } from '../lib/db';
import { PendingObligation, PendingReturn, WalletTransaction } from '../types';

function mapTx(r: any): WalletTransaction {
  return {
    id: r.id, type: r.type, status: r.status,
    fromUserId: r.from_user_id, fromUserName: r.from_user_name,
    toUserId: r.to_user_id, toUserName: r.to_user_name,
    projectId: r.project_id, projectTitle: r.project_title,
    investmentId: r.investment_id, amount: Number(r.amount),
    description: r.description,
    scheduledFor: r.scheduled_for, createdAt: r.created_at,
    completedAt: r.completed_at, direction: r.direction,
  };
}

export async function listForUser(userId: string): Promise<WalletTransaction[]> {
  const rows = await callFn('fn_wallet_transactions_for_user', [userId]);
  return rows.map(mapTx);
}

export async function pendingReturnsForInvestor(investorId: string): Promise<PendingReturn[]> {
  const rows = await callFn<any>('fn_pending_returns_for_investor', [investorId]);
  return rows.map(r => ({
    transactionId: r.transaction_id, projectId: r.project_id, projectTitle: r.project_title,
    investmentId: r.investment_id, amount: Number(r.amount),
    scheduledFor: r.scheduled_for, daysRemaining: Number(r.days_remaining),
  }));
}

export async function pendingObligationsForFarmer(farmerId: string): Promise<PendingObligation[]> {
  const rows = await callFn<any>('fn_pending_obligations_for_farmer', [farmerId]);
  return rows.map(r => ({
    transactionId: r.transaction_id, projectId: r.project_id, projectTitle: r.project_title,
    investorId: r.investor_id, investorName: r.investor_name,
    amount: Number(r.amount),
    scheduledFor: r.scheduled_for, daysUntilDue: Number(r.days_until_due),
  }));
}

export async function processDueReturns(): Promise<number> {
  return Number(await callFnScalar('fn_process_due_returns'));
}

export async function settleProject(projectId: string): Promise<number> {
  return Number(await callFnScalar('fn_settle_project', [projectId]));
}

export async function payReturn(transactionId: string, actorId: string, actorRole: string): Promise<WalletTransaction | null> {
  const row = await callFnOne<any>('fn_pay_return_as', [transactionId, actorId, actorRole]);
  if (!row) return null;
  // fn_pay_investment_return devuelve una fila cruda de wallet_transactions
  // (no la vista enriquecida). Rellenamos los joins con null.
  return {
    id: row.id, type: row.type, status: row.status,
    fromUserId: row.from_user_id, fromUserName: null,
    toUserId: row.to_user_id, toUserName: null,
    projectId: row.project_id, projectTitle: null,
    investmentId: row.investment_id, amount: Number(row.amount),
    description: row.description,
    scheduledFor: row.scheduled_for, createdAt: row.created_at,
    completedAt: row.completed_at, direction: 'other',
  };
}
