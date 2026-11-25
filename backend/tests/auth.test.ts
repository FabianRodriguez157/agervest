import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app } from './setup';

describe('auth', () => {
  const email = 'test.farmer@agervest.pe';
  const password = 'secret123';

  it('registra un agricultor y devuelve sesión', async () => {
    const res = await request(app).post('/api/auth/register-farmer').send({
      name: 'Test Farmer', email, password, phone: '999111222',
      location: 'Puno', cropType: 'Quinua', areaHa: 2,
      documentId: '12345678', bankAccount: '001-123',
      termsAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user).not.toHaveProperty('password_hash');
  });

  it('rechaza email duplicado con 409', async () => {
    const res = await request(app).post('/api/auth/register-farmer').send({
      name: 'Dup', email, password, phone: '999111222',
      location: 'Puno', cropType: 'Quinua', areaHa: 2,
      documentId: '12345678', bankAccount: '001-123', termsAccepted: true,
    });
    expect(res.status).toBe(409);
  });

  it('login válido devuelve token y user', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password, role: 'farmer' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(email);
  });

  it('login con password incorrecto devuelve 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email, password: 'xxx', role: 'farmer' });
    expect(res.status).toBe(401);
  });

  it('/me requiere sesión', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('permite solicitar verificación con sesión activa', async () => {
    const { agent } = await loginAs('farmer', email, password);
    const res = await agent.post('/api/auth/request-verification').send({});
    expect(res.status).toBe(200);
    expect(res.body.verified).toBe(false);
    expect(res.body.verificationRequestedAt).toBeTruthy();
  });
});
