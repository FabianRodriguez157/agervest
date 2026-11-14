import { callFn, callFnOne } from '../lib/db';
import { Ally } from '../types';

function mapRow(r: any): Ally {
  return {
    id: r.id, email: r.email, role: 'ally', name: r.name, phone: r.phone, country: r.country,
    verified: r.verified, termsAccepted: r.terms_accepted,
    createdAt: r.created_at, updatedAt: r.updated_at,
    organization: r.organization, roleDescription: r.role_description,
  };
}

export async function findById(id: string): Promise<Ally | null> {
  const row = await callFnOne('fn_ally_get', [id]);
  return row ? mapRow(row) : null;
}

export async function findByEmail(email: string): Promise<(Ally & { passwordHash: string }) | null> {
  const row = await callFnOne<any>('fn_ally_auth_by_email', [email]);
  return row ? { ...mapRow(row), passwordHash: row.password_hash } : null;
}

export interface CreateAllyInput {
  name: string; email: string; passwordHash: string; phone?: string; country?: string;
  organization: string; roleDescription?: string; termsAccepted: boolean;
}

export async function create(input: CreateAllyInput): Promise<Ally> {
  const row = await callFnOne('fn_ally_create', [
    input.email, input.passwordHash, input.name,
    input.phone ?? null, input.country ?? null,
    input.organization, input.roleDescription ?? null, input.termsAccepted,
  ]);
  if (!row) throw new Error('Ally insert failed');
  return mapRow(row);
}
