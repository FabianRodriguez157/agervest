import { callFn, callFnOne } from '../lib/db';
import { Farmer } from '../types';

function mapRow(r: any): Farmer {
  return {
    id: r.id, email: r.email, role: 'farmer', name: r.name,
    phone: r.phone, country: r.country, verified: r.verified,
    termsAccepted: r.terms_accepted, createdAt: r.created_at, updatedAt: r.updated_at,
    location: r.location, cropType: r.crop_type, areaHa: Number(r.area_ha),
    documentId: r.document_id, documentUrl: r.document_url,
    yearsExperience: r.years_experience, certifications: r.certifications || [],
    bankAccount: r.bank_account, paymentMethod: r.payment_method,
    agriculturalCertified: r.agricultural_certified, validated: r.validated,
    trustScore: r.trust_score, avatarSeed: r.avatar_seed,
    walletBalance: Number(r.wallet_balance ?? 0),
  };
}

export async function findById(id: string): Promise<Farmer | null> {
  const row = await callFnOne('fn_farmer_get', [id]);
  return row ? mapRow(row) : null;
}

export async function findByEmail(email: string): Promise<(Farmer & { passwordHash: string }) | null> {
  const row = await callFnOne<any>('fn_farmer_auth_by_email', [email]);
  return row ? { ...mapRow(row), passwordHash: row.password_hash } : null;
}

export async function list(): Promise<Farmer[]> {
  const rows = await callFn('fn_farmer_list');
  return rows.map(mapRow);
}

export interface CreateFarmerInput {
  name: string; email: string; passwordHash: string; phone: string; country?: string;
  location: string; cropType: string; areaHa: number; documentId: string;
  documentUrl?: string; yearsExperience?: number; certifications?: string[];
  bankAccount: string; paymentMethod?: 'bank_transfer' | 'wallet' | 'other';
  agriculturalCertified?: boolean; termsAccepted: boolean;
}

export async function create(input: CreateFarmerInput): Promise<Farmer> {
  const row = await callFnOne('fn_farmer_create', [
    input.email, input.passwordHash, input.name, input.phone, input.country ?? null,
    input.location, input.cropType, input.areaHa, input.documentId, input.documentUrl ?? null,
    input.yearsExperience ?? null, input.certifications ?? null,
    input.bankAccount, input.paymentMethod ?? null,
    input.agriculturalCertified ?? null, input.termsAccepted,
  ]);
  if (!row) throw new Error('Farmer insert failed');
  return mapRow(row);
}

export async function markValidated(id: string): Promise<Farmer | null> {
  const row = await callFnOne('fn_farmer_mark_validated', [id]);
  return row ? mapRow(row) : null;
}
