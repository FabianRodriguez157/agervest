import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, loginAs } from './setup';

describe('inversión: mueve dinero real inversor → agricultor', () => {
  const farmerEmail = 'farmer.invest@agervest.pe';
  const investorEmail = 'investor.invest@agervest.pe';
  const password = 'secret123';
  let farmerId: string;
  let investorId: string;
  let projectId: string;

  it('setup: registra agricultor, inversor y proyecto', async () => {
    const f = await request(app).post('/api/auth/register-farmer').send({
      name: 'Rosa', email: farmerEmail, password, phone: '9991',
      location: 'Puno', cropType: 'Quinua', areaHa: 3,
      documentId: '41111111', bankAccount: '001', termsAccepted: true,
    });
    farmerId = f.body.user.id;

    const i = await request(app).post('/api/auth/register-investor').send({
      name: 'Daniela', email: investorEmail, password,
      investmentBudget: 10000, termsAccepted: true, riskAcknowledgment: true,
    });
    investorId = i.body.user.id;
    expect(Number(i.body.user.walletBalance)).toBeGreaterThanOrEqual(5000);

    // Verifica al inversor (requisito para invertir)
    const { agent } = await loginAs('investor', investorEmail, password);
    await agent.post('/api/auth/investor/verify').send({ documentId: '70000000', phone: '9992', bankAccount: '002' });

    // Crea proyecto como farmer
    const { agent: fa } = await loginAs('farmer', farmerEmail, password);
    const p = await fa.post('/api/projects').send({
      title: 'Proyecto Test Quinua', crop: 'Quinua',
      description: 'Descripción larga del proyecto.', location: 'Puno',
      projectAreaHa: 2, cropVariety: 'Real', investmentNeeded: 5000,
      durationMonths: 3, risk: 'bajo', expectedReturnPct: 10,
      objectives: 'Objetivos', benefits: 'Beneficios', riskMitigation: 'Mitigación',
      termsAccepted: true, updatesAccepted: true,
    });
    expect(p.status).toBe(201);
    projectId = p.body.id;
  });

  it('al invertir, el saldo del inversor baja y el del agricultor sube', async () => {
    const { agent: inv } = await loginAs('investor', investorEmail, password);
    const res = await inv.post('/api/investments').send({ projectId, amount: 1000 });
    expect(res.status).toBe(201);

    const investorAfter = await request(app).get(`/api/investors/${investorId}`);
    const farmerAfter = await request(app).get(`/api/farmers/${farmerId}`);

    expect(Number(investorAfter.body.walletBalance)).toBe(10000 - 1000);
    expect(Number(farmerAfter.body.walletBalance)).toBe(1000);
  });

  it('se registró un retorno pendiente a nombre del inversor', async () => {
    const { agent: inv } = await loginAs('investor', investorEmail, password);
    const res = await inv.get('/api/wallet/pending-returns');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    const ret = res.body[0];
    expect(ret.projectId).toBe(projectId);
    expect(Number(ret.amount)).toBeCloseTo(1000 * 1.10, 2);
  });

  it('invertir más que el remaining funding lo rechaza', async () => {
    const { agent: inv } = await loginAs('investor', investorEmail, password);
    const res = await inv.post('/api/investments').send({ projectId, amount: 999999 });
    expect(res.status).toBe(400);
  });

  it('rechaza inversión sin verificación', async () => {
    // Nuevo investor sin verificar
    const r = await request(app).post('/api/auth/register-investor').send({
      name: 'No Verif', email: 'noverif@agervest.pe', password,
      investmentBudget: 5000, termsAccepted: true, riskAcknowledgment: true,
    });
    expect(r.status).toBe(201);
    const { agent } = await loginAs('investor', 'noverif@agervest.pe', password);
    const res = await agent.post('/api/investments').send({ projectId, amount: 100 });
    expect([400, 403]).toContain(res.status);
  });
});
