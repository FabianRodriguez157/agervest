import request from 'supertest';
import { describe, it, expect } from 'vitest';
import { app, loginAs } from './setup';

describe('projects', () => {
  const email = 'farmer.proj@agervest.pe';
  const password = 'secret123';
  let projectId: string;

  it('setup: agricultor', async () => {
    const r = await request(app).post('/api/auth/register-farmer').send({
      name: 'Proj', email, password, phone: '9',
      location: 'Cusco', cropType: 'Cafe', areaHa: 2,
      documentId: '41222222', bankAccount: '001', termsAccepted: true,
    });
    expect(r.status).toBe(201);
  });

  it('crea un proyecto autenticado', async () => {
    const { agent } = await loginAs('farmer', email, password);
    const res = await agent.post('/api/projects').send({
      title: 'Café de altura', crop: 'Cafe',
      description: 'Renovación de cafetales con variedades resistentes a la roya.',
      location: 'Cusco', projectAreaHa: 2, cropVariety: 'Catimor',
      investmentNeeded: 15000, durationMonths: 12, risk: 'medio', expectedReturnPct: 15,
      objectives: 'Mejorar rendimiento.', benefits: 'Mejor precio.',
      riskMitigation: 'Variedades resistentes y asistencia técnica.',
      hasInsurance: 'planning', priorExperience: 'assisted',
      certification: 'in_transition', technicalSupport: 'contractor',
      termsAccepted: true, updatesAccepted: true,
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('active');
    expect(Number(res.body.amountRaised)).toBe(0);
    projectId = res.body.id;
  });

  it('rechaza crear proyecto sin sesión', async () => {
    const res = await request(app).post('/api/projects').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('lista proyectos con filtro por cultivo', async () => {
    const res = await request(app).get('/api/projects?crop=Cafe');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every((p: any) => p.crop.toLowerCase() === 'cafe')).toBe(true);
  });

  it('devuelve project full con farmer, token y risk assessment', async () => {
    const res = await request(app).get(`/api/projects/${projectId}`);
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(projectId);
    expect(res.body.token).toBeTruthy();
    expect(res.body.riskAssessment.factors).toHaveLength(7);
  });

  it('el agricultor publica un avance y el progress sube', async () => {
    const { agent } = await loginAs('farmer', email, password);
    const u = await agent.post(`/api/projects/${projectId}/updates`).send({
      message: 'Vivero establecido', progressDelta: 15,
    });
    expect(u.status).toBe(201);
    const p = await request(app).get(`/api/projects/${projectId}`);
    expect(p.body.project.progress).toBe(15);
  });
});
