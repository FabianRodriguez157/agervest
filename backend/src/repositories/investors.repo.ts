import { callFn, callFnOne } from '../lib/db';
import { Investor } from '../types';

function mapRow(r: any): Investor {
  return {
    id: r.id, email: r.email, role: 'investor', name: r.name, phone: r.phone, country: r.country,
    verified: r.verified, termsAccepted: r.terms_accepted,
    createdAt: r.created_at, updatedAt: r.updated_at,
    documentId: r.document_id, documentIdType: r.document_id_type, occupation: r.occupation,
    investmentExperience: r.investment_experience, investmentFrequency: r.investment_frequency,
    investmentBudget: Number(r.investment_budget), riskProfile: r.risk_profile,
    bankAccount: r.bank_account, paymentMethod: r.payment_method,
    walletBalance: Number(r.wallet_balance), riskAcknowledgment: r.risk_acknowledgment,
  };
}

export async function findById(id: string): Promise<Investor | null> {
  const row = await callFnOne('fn_investor_get', [id]);
  return row ? mapRow(row) : null;
}

export async function findByEmail(email: string): Promise<(Investor & { passwordHash: string }) | null> {
  const row = await callFnOne<any>('fn_investor_auth_by_email', [email]);
  return row ? { ...mapRow(row), passwordHash: row.password_hash } : null;
}

export interface CreateInvestorInput {
  name: string; email: string; passwordHash: string; phone?: string; country?: string;
  documentId?: string; documentIdType?: 'DNI' | 'CE' | 'PASSPORT'; occupation?: string;
  investmentExperience?: 'none' | 'basic' | 'intermediate' | 'advanced';
  investmentFrequency?: 'monthly' | 'quarterly' | 'annual' | 'sporadic';
  investmentBudget?: number; riskProfile?: 'conservador' | 'moderado' | 'agresivo';
  bankAccount?: string; paymentMethod?: 'bank_transfer' | 'wallet' | 'credit_card';
  termsAccepted: boolean; riskAcknowledgment: boolean;
}

export async function create(input: CreateInvestorInput): Promise<Investor> {
  const row = await callFnOne('fn_investor_create', [
    input.email, input.passwordHash, input.name, input.phone ?? null, input.country ?? null,
    input.documentId ?? null, input.documentIdType ?? null, input.occupation ?? null,
    input.investmentExperience ?? null, input.investmentFrequency ?? null,
    input.investmentBudget ?? null, input.riskProfile ?? null,
    input.bankAccount ?? null, input.paymentMethod ?? null,
    input.termsAccepted, input.riskAcknowledgment,
  ]);
  if (!row) throw new Error('Investor insert failed');
  return mapRow(row);
}

export async function verify(
  id: string,
  patch: { documentId?: string; phone?: string; bankAccount?: string } = {}
): Promise<Investor | null> {
  const row = await callFnOne('fn_investor_verify', [
    id, patch.documentId ?? null, patch.phone ?? null, patch.bankAccount ?? null,
  ]);
  return row ? mapRow(row) : null;
}
