import { describe, it, expect } from 'vitest';
import { buildRiskAssessment, RISK_WEIGHTS } from '../src/services/risk.service';
import { Project, Farmer } from '../src/types';

function mkProject(partial: Partial<Project> = {}): Project {
  return {
    id: 'p1', farmerId: 'f1', title: 'T', crop: 'Quinua', description: '',
    location: 'Puno', projectAreaHa: 1, cropVariety: 'R',
    investmentNeeded: 1000, amountRaised: 0, amountAvailable: 0,
    durationMonths: 6, risk: 'medio', expectedReturnPct: 10,
    paymentMethod: 'percentage', objectives: '', benefits: '', riskMitigation: '',
    hasInsurance: 'no', priorExperience: 'new', certification: 'conventional',
    technicalSupport: 'own_experience', imageUrl: null, documentUrl: null,
    status: 'active', progress: 0, featured: false,
    termsAccepted: true, updatesAccepted: true,
    createdAt: new Date(), updatedAt: new Date(),
    ...partial,
  };
}

function mkFarmer(partial: Partial<Farmer> = {}): Farmer {
  return {
    id: 'f1', email: 'a@b.c', role: 'farmer', name: 'F', phone: null, country: 'PE',
    verified: true, termsAccepted: true, createdAt: new Date(), updatedAt: new Date(),
    location: 'Puno', cropType: 'Quinua', areaHa: 1, documentId: '1',
    documentUrl: null, yearsExperience: 5, certifications: [],
    bankAccount: '1', paymentMethod: 'bank_transfer',
    agriculturalCertified: false, validated: true, trustScore: 80,
    avatarSeed: null, walletBalance: 0,
    ...partial,
  };
}

describe('risk assessment', () => {
  it('los pesos de los 7 factores suman 100', () => {
    const sum = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it('proyecto bien mitigado da riesgo bajo', () => {
    const p = mkProject({
      crop: 'Palta', hasInsurance: 'yes', priorExperience: 'yes',
      certification: 'organic', technicalSupport: 'agro_company', durationMonths: 3,
    });
    const r = buildRiskAssessment(p, mkFarmer({ trustScore: 95 }));
    expect(r.computedRisk).toBe('bajo');
    expect(r.riskScorePct).toBeLessThanOrEqual(33);
    expect(r.factors).toHaveLength(7);
  });

  it('proyecto desprotegido da riesgo alto', () => {
    const p = mkProject({
      crop: 'Uva', hasInsurance: 'no', priorExperience: 'new',
      certification: 'conventional', technicalSupport: 'own_experience', durationMonths: 14,
    });
    const r = buildRiskAssessment(p, null);
    expect(r.computedRisk).toBe('alto');
    expect(r.riskScorePct).toBeGreaterThan(66);
  });

  it('contribuciones suman al score final', () => {
    const r = buildRiskAssessment(mkProject(), mkFarmer());
    const sum = r.factors.reduce((a, f) => a + f.contribution, 0);
    expect(sum).toBeCloseTo(r.riskScorePct, 1);
  });

  it('señala inconsistencia entre riesgo declarado y calculado', () => {
    const p = mkProject({
      risk: 'bajo', crop: 'Uva', hasInsurance: 'no',
      priorExperience: 'new', technicalSupport: 'own_experience', durationMonths: 14,
    });
    const r = buildRiskAssessment(p, null);
    expect(r.consistent).toBe(false);
    expect(r.declaredRisk).toBe('bajo');
    expect(r.computedRisk).toBe('alto');
  });
});
