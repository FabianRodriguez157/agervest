import { callFnOne } from '../lib/db';

export async function findByEmail(email: string) {
  const row = await callFnOne<any>('fn_admin_auth_by_email', [email]);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, passwordHash: row.password_hash };
}

export async function findById(id: string) {
  const row = await callFnOne<any>('fn_admin_get', [id]);
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name, phone: row.phone, country: row.country, createdAt: row.created_at };
}

export async function create(data: { email: string; passwordHash: string; name: string; phone?: string }) {
  const row = await callFnOne<any>('fn_admin_create', [data.email, data.passwordHash, data.name, data.phone ?? null]);
  return { id: row.id, email: row.email, name: row.name };
}
