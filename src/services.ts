import { v4 as uuid } from 'uuid';
import {
  Farmer,
  Project,
  Investment,
  Investor,
  Ally,
  Token,
  ProjectUpdate,
  DashboardStats,
  ProjectRisk,
  RiskFactor,
  RiskAssessment,
  SeasonInfo,
} from './types';

const CROP_IMAGES: Record<string, string> = {
  quinua: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800',
  cafe: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
  palta: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800',
  uva: 'https://images.unsplash.com/photo-1596363505729-4190a9506133?w=800',
  papa: 'https://images.unsplash.com/photo-1552294837-3d3dc1cca8d5?w=800',
  default: 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800',
};

// Base climate/season knowledge per crop (prototype-level, informative, not real-time data).
const CROP_SEASON: Record<string, { ciclo: string; siembra: string; cosecha: string; climaIdeal: string; riesgos: string[]; basePoints: number }> = {
  quinua: { ciclo: '5 a 7 meses', siembra: 'Setiembre a noviembre', cosecha: 'Abril a mayo', climaIdeal: 'Clima frío de altura, suelos bien drenados, heladas moderadas toleradas', riesgos: ['Heladas tempranas fuera de temporada', 'Granizo en floración', 'Sequía en etapa de llenado de grano'], basePoints: 0 },
  cafe: { ciclo: 'Perenne, cosecha anual', siembra: 'Instalación en época de lluvias (octubre-diciembre)', cosecha: 'Abril a agosto según altitud', climaIdeal: 'Clima templado-cálido, 18-24°C, sombra parcial, lluvias bien distribuidas', riesgos: ['Roya amarilla en años húmedos', 'Broca del café', 'Variabilidad de precio internacional'], basePoints: 1 },
  palta: { ciclo: 'Perenne, 1-2 cosechas/año', siembra: 'Instalación en inicio de lluvias o con riego tecnificado', cosecha: 'Abril a setiembre (Hass, costa)', climaIdeal: 'Clima templado, sensible a heladas y a estrés hídrico en floración', riesgos: ['Estrés hídrico si falla el riego', 'Heladas en etapa de floración', 'Exigencias fitosanitarias de exportación'], basePoints: 0 },
  uva: { ciclo: 'Perenne, cosecha anual', siembra: 'Poda e inducción en invierno (junio-agosto)', cosecha: 'Diciembre a febrero (costa)', climaIdeal: 'Clima cálido-seco con riego controlado, muy sensible a granizo y lluvias en cosecha', riesgos: ['Granizo en racimo', 'Lluvias en cosecha (rajado de baya)', 'Alta inversión en protección climática'], basePoints: 2 },
  papa: { ciclo: '4 a 6 meses', siembra: 'Agosto a octubre (según piso altitudinal)', cosecha: 'Enero a abril', climaIdeal: 'Clima templado-frío de sierra, sensible a heladas en brotamiento', riesgos: ['Heladas en brotamiento', 'Rancha (Phytophthora) en años húmedos', 'Volatilidad de precio en chacra'], basePoints: 1 },
  default: { ciclo: 'Variable según cultivo', siembra: 'Depende del cultivo y la región', cosecha: 'Depende del cultivo y la región', climaIdeal: 'Información específica no disponible para este cultivo', riesgos: ['Exposición climática general de la zona'], basePoints: 1 },
};

// Region-level climate notes inferred from the free-text location field.
const REGION_CLIMATE: Record<string, { clima: string; riesgos: string[] }> = {
  puno: { clima: 'Altiplano, 3800+ msnm, clima frío y seco con fuerte oscilación térmica día/noche', riesgos: ['Heladas (jun-ago)', 'Granizadas en temporada de lluvias (dic-mar)'] },
  cusco: { clima: 'Valle interandino, clima templado con estación seca (abr-oct) y lluviosa (nov-mar)', riesgos: ['Heladas en valles altos', 'Lluvias intensas en enero-febrero'] },
  arequipa: { clima: 'Costa-sierra árida, alta radiación solar, muy baja precipitación, dependiente de riego', riesgos: ['Escasez hídrica / dependencia de riego tecnificado', 'Heladas nocturnas en invierno'] },
  ica: { clima: 'Desierto costero, cálido y seco todo el año, agricultura 100% bajo riego', riesgos: ['Dependencia total del riego (sin lluvia)', 'Eventos El Niño (lluvias atípicas y plagas)'] },
  default: { clima: 'Clima variable según la zona declarada', riesgos: ['Exposición climática no especificada en detalle'] },
};

function getSeasonInfo(crop: string, location: string): SeasonInfo {
  const c = CROP_SEASON[crop.toLowerCase()] || CROP_SEASON.default;
  const regionKey = Object.keys(REGION_CLIMATE).find(k => location.toLowerCase().includes(k)) || 'default';
  const region = REGION_CLIMATE[regionKey];
  return {
    ciclo: c.ciclo,
    siembra: c.siembra,
    cosecha: c.cosecha,
    climaIdeal: c.climaIdeal,
    riesgosClimaticos: c.riesgos,
    regionClima: region.clima,
    regionRiesgos: region.riesgos,
  };
}

// Cada factor tiene un peso fijo (weightPct) sobre el puntaje final; los pesos de
// todos los factores suman exactamente 100. Dentro de cada factor se asigna un
// valueScore de 0 (mínimo riesgo posible para ese factor) a 100 (máximo riesgo
// posible), y su aporte al puntaje final es weightPct/100 * valueScore. La suma de
// los aportes de los 7 factores da el riskScorePct final (0-100%).
const RISK_WEIGHTS = {
  clima: 25,
  seguro: 20,
  experiencia: 15,
  soporte: 15,
  certificacion: 10,
  confianza: 10,
  duracion: 5,
} as const; // 25+20+15+15+10+10+5 = 100

function buildRiskAssessment(project: Project, farmer?: Farmer): RiskAssessment {
  const factors: RiskFactor[] = [];
  const push = (label: string, weightPct: number, valueScore: number, explanation: string) => {
    const v = Math.max(0, Math.min(100, valueScore));
    factors.push({ label, weightPct, valueScore: v, contribution: Number((weightPct / 100 * v).toFixed(2)), explanation });
  };

  // 1) Exposición climática propia del cultivo (0-100 según sensibilidad conocida)
  const cropScore: Record<string, number> = { quinua: 20, cafe: 55, palta: 20, uva: 90, papa: 40 };
  const cs = cropScore[project.crop.toLowerCase()] ?? 55;
  push('Exposición climática del cultivo', RISK_WEIGHTS.clima, cs,
    `Cultivo "${project.crop}": nivel de exposición climática histórica asignado = ${cs}/100.`);

  // 2) Cobertura de seguro agrícola
  const seguroScore = project.hasInsurance === 'yes' ? 10 : project.hasInsurance === 'planning' ? 50 : 90;
  push('Cobertura de seguro agrícola', RISK_WEIGHTS.seguro, seguroScore,
    project.hasInsurance === 'yes' ? 'Seguro agrícola contratado (score bajo = 10).'
    : project.hasInsurance === 'planning' ? 'Seguro agrícola en trámite, aún no contratado (score medio = 50).'
    : 'Sin seguro agrícola contratado ni en trámite (score alto = 90).');

  // 3) Experiencia previa del agricultor con este tipo de proyecto
  const expScore = project.priorExperience === 'yes' ? 15 : project.priorExperience === 'assisted' ? 50 : 90;
  push('Experiencia previa del agricultor', RISK_WEIGHTS.experiencia, expScore,
    project.priorExperience === 'yes' ? 'Experiencia previa directa en este tipo de proyecto (score bajo = 15).'
    : project.priorExperience === 'assisted' ? 'Cuenta con asistencia técnica que compensa su experiencia (score medio = 50).'
    : 'Primera vez que ejecuta este tipo de proyecto (score alto = 90).');

  // 4) Soporte técnico disponible durante la ejecución
  const supScore = (project.technicalSupport === 'government' || project.technicalSupport === 'agro_company') ? 15
    : project.technicalSupport === 'contractor' ? 45 : 75;
  push('Soporte técnico del proyecto', RISK_WEIGHTS.soporte, supScore,
    supScore === 15 ? 'Soporte técnico de una entidad del Estado o empresa agroexportadora (score bajo = 15).'
    : supScore === 45 ? 'Soporte de un técnico/consultor contratado (score medio = 45).'
    : 'Depende principalmente de la experiencia propia del agricultor (score alto = 75).');

  // 5) Certificación del producto (afecta exposición a volatilidad de precio)
  const certScore = (project.certification === 'organic' || project.certification === 'fair_trade') ? 20
    : project.certification === 'in_transition' ? 55 : 70;
  push('Certificación del producto', RISK_WEIGHTS.certificacion, certScore,
    certScore === 20 ? `Certificación "${project.certification}" reduce exposición a volatilidad de precio commodity (score bajo = 20).`
    : certScore === 55 ? 'Certificación en proceso de transición, beneficio aún no consolidado (score medio = 55).'
    : 'Producto convencional, expuesto a precio de mercado commodity (score alto = 70).');

  // 6) Confianza/validación del agricultor en la plataforma
  const confScore = !farmer ? 90 : !farmer.validated ? 90 : Math.max(0, 100 - farmer.trustScore);
  push('Confianza del agricultor validado', RISK_WEIGHTS.confianza, confScore,
    !farmer || !farmer.validated ? 'Perfil de agricultor aún no validado en la plataforma (score alto = 90).'
    : `Agricultor validado con score de confianza ${farmer.trustScore}/100 → riesgo = 100 - ${farmer.trustScore} = ${confScore}.`);

  // 7) Duración del proyecto (ventana de exposición a eventos climáticos/mercado)
  const durScore = project.duration >= 12 ? 70 : project.duration >= 6 ? 40 : 20;
  push('Duración del proyecto', RISK_WEIGHTS.duracion, durScore,
    `Duración de ${project.duration} meses → ventana de exposición clasificada en ${durScore}/100.`);

  const riskScorePct = Number(factors.reduce((s, f) => s + f.contribution, 0).toFixed(1));
  const computedRisk: ProjectRisk = riskScorePct <= 33 ? 'bajo' : riskScorePct <= 66 ? 'medio' : 'alto';
  const consistent = computedRisk === project.risk;

  const note = consistent
    ? `El riesgo declarado ("${project.risk}") coincide con el puntaje calculado de ${riskScorePct}%.`
    : `El agricultor declaró riesgo "${project.risk}", pero la suma ponderada de factores da ${riskScorePct}%, lo que corresponde a riesgo "${computedRisk}". Revisa los factores antes de invertir.`;

  return { declaredRisk: project.risk, computedRisk, riskScorePct, consistent, factors, note };
}

export class AgerVestService {
  private farmers = new Map<string, Farmer>();
  private projects = new Map<string, Project>();
  private investments = new Map<string, Investment>();
  private investors = new Map<string, Investor>();
  private allies = new Map<string, Ally>();
  private tokens = new Map<string, Token>();
  private updates = new Map<string, ProjectUpdate[]>();

  constructor() {
    this.seed();
  }

  // ---------- Farmers ----------
  createFarmer(data: {
    name: string; email: string; password?: string; phone: string; location: string; cropType: string;
    areaHa: number; documentId: string; documentUrl?: string; yearsExperience?: number;
    certifications?: string[]; agriculturalCertified?: boolean; bankAccount: string;
    paymentMethod: string; termsAccepted?: boolean;
  }): Farmer {
    if (this.findFarmerByEmail(data.email)) throw new Error('Ya existe una cuenta de agricultor con ese correo');
    if (!data.termsAccepted) throw new Error('Debe aceptar los términos y condiciones');
    
    const farmer: Farmer = {
      id: uuid(),
      name: data.name,
      email: data.email,
      password: data.password || '',
      phone: data.phone,
      location: data.location,
      cropType: data.cropType,
      areaHa: data.areaHa,
      documentId: data.documentId,
      documentUrl: data.documentUrl,
      yearsExperience: data.yearsExperience || 0,
      certifications: data.certifications || [],
      bankAccount: data.bankAccount,
      paymentMethod: (data.paymentMethod as 'bank_transfer' | 'wallet' | 'other') || 'bank_transfer',
      agriculturalCertified: data.agriculturalCertified || false,
      validated: false,
      trustScore: 60,
      avatarSeed: data.name.replace(/\s+/g, ''),
      termsAccepted: data.termsAccepted || false,
      createdAt: new Date(),
    };
    this.farmers.set(farmer.id, farmer);
    return farmer;
  }

  getFarmer(id: string): Farmer | undefined {
    return this.farmers.get(id);
  }

  listFarmers(): Farmer[] {
    return Array.from(this.farmers.values());
  }

  findFarmerByEmail(email: string): Farmer | undefined {
    return Array.from(this.farmers.values()).find(f => f.email.toLowerCase() === email.toLowerCase());
  }

  loginFarmer(email: string, password: string): Farmer | undefined {
    const farmer = this.findFarmerByEmail(email);
    if (!farmer || farmer.password !== password) return undefined;
    return farmer;
  }

  validateFarmer(id: string): Farmer | undefined {
    const f = this.farmers.get(id);
    if (!f) return undefined;
    f.validated = true;
    f.trustScore = Math.min(100, f.trustScore + 25);
    return f;
  }

  // ---------- Projects ----------
  createProject(data: {
    farmerId: string; title: string; crop: string; description: string;
    location: string; projectAreaHa: number; cropVariety: string;
    investmentNeeded: number; amountAvailable?: number; duration: number;
    risk: ProjectRisk; expectedReturnPct: number; paymentMethod?: string;
    objectives: string; benefits: string; riskMitigation: string;
    hasInsurance?: string; priorExperience?: string;
    certification?: string; technicalSupport?: string;
    imageUrl?: string; documentUrl?: string;
    termsAccepted?: boolean; updatesAccepted?: boolean;
  }): Project {
    if (!data.termsAccepted) throw new Error('Debes aceptar los términos del proyecto');
    if (!data.updatesAccepted) throw new Error('Debes comprometerte a proporcionar actualizaciones');
    if ((data.amountAvailable || 0) > data.investmentNeeded) throw new Error('Inversión disponible no puede ser mayor a requerida');

    const project: Project = {
      id: uuid(),
      farmerId: data.farmerId,
      title: data.title,
      crop: data.crop,
      description: data.description,
      location: data.location,
      projectAreaHa: data.projectAreaHa,
      cropVariety: data.cropVariety,
      investmentNeeded: data.investmentNeeded,
      amountRaised: 0,
      amountAvailable: data.amountAvailable || 0,
      duration: data.duration,
      risk: data.risk,
      expectedReturnPct: data.expectedReturnPct,
      paymentMethod: (data.paymentMethod as 'percentage' | 'fixed' | 'monthly' | 'harvest') || 'percentage',
      objectives: data.objectives,
      benefits: data.benefits,
      riskMitigation: data.riskMitigation,
      hasInsurance: (data.hasInsurance as 'yes' | 'planning' | 'no') || 'no',
      priorExperience: (data.priorExperience as 'yes' | 'assisted' | 'new') || 'assisted',
      certification: (data.certification as 'organic' | 'conventional' | 'in_transition' | 'fair_trade' | 'other') || 'conventional',
      technicalSupport: (data.technicalSupport as 'own_experience' | 'contractor' | 'government' | 'agro_company' | 'other') || 'own_experience',
      imageUrl: data.imageUrl || CROP_IMAGES[data.crop.toLowerCase()] || CROP_IMAGES.default,
      documentUrl: data.documentUrl,
      status: 'active',
      progress: 0,
      featured: false,
      termsAccepted: data.termsAccepted || false,
      updatesAccepted: data.updatesAccepted || false,
      createdAt: new Date(),
    };
    this.projects.set(project.id, project);

    const token: Token = {
      id: uuid(),
      projectId: project.id,
      symbol: 'AGV-' + project.title.substring(0, 3).toUpperCase(),
      totalSupply: 1000,
      price: Number((data.investmentNeeded / 1000).toFixed(2)),
      circulating: 0,
    };
    this.tokens.set(project.id, token);
    this.updates.set(project.id, []);
    return project;
  }

  getProject(id: string): Project | undefined {
    return this.projects.get(id);
  }

  getProjectFull(id: string) {
    const project = this.projects.get(id);
    if (!project) return undefined;
    const farmer = this.farmers.get(project.farmerId);
    const token = this.tokens.get(id);
    const updates = this.updates.get(id) || [];
    const investmentsForProject = Array.from(this.investments.values()).filter(i => i.projectId === id);
    const riskAssessment = buildRiskAssessment(project, farmer);
    const seasonInfo = getSeasonInfo(project.crop, project.location);
    return { project, farmer, token, updates, investorsCount: new Set(investmentsForProject.map(i => i.investorId)).size, riskAssessment, seasonInfo };
  }

  listProjects(filters?: { crop?: string; risk?: string; status?: string; q?: string }): Project[] {
    let list = Array.from(this.projects.values());
    if (filters?.crop) list = list.filter(p => p.crop.toLowerCase() === filters.crop!.toLowerCase());
    if (filters?.risk) list = list.filter(p => p.risk === filters.risk);
    if (filters?.status) list = list.filter(p => p.status === filters.status);
    if (filters?.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.crop.toLowerCase().includes(q) || p.location.toLowerCase().includes(q));
    }
    return list.sort((a, b) => Number(b.featured) - Number(a.featured));
  }

  // Lightweight version used by the catalog and the investor portfolio simulator,
  // where a full factor breakdown isn't needed — just the contrasted risk label.
  listProjectsWithComputedRisk(filters?: { crop?: string; risk?: string; status?: string; q?: string }) {
    return this.listProjects(filters).map(p => {
      const farmer = this.farmers.get(p.farmerId);
      const { computedRisk, consistent, riskScorePct } = buildRiskAssessment(p, farmer);
      const producerScore = farmer?.trustScore ?? 0;
      const verification = farmer?.validated ? 100 : 60;
      const confidenceIndex = Math.round((producerScore + (100 - riskScorePct) + verification) / 3);
      return { ...p, computedRisk, riskConsistent: consistent, riskScorePct, producerScore, verificationCompleteness: verification, confidenceIndex };
    });
  }

  addProjectUpdate(projectId: string, message: string, progressDelta: number, imageUrl?: string): ProjectUpdate | undefined {
    const project = this.projects.get(projectId);
    if (!project) return undefined;
    const update: ProjectUpdate = { id: uuid(), projectId, message, progressDelta, imageUrl, createdAt: new Date() };
    const arr = this.updates.get(projectId) || [];
    arr.unshift(update);
    this.updates.set(projectId, arr);
    project.progress = Math.min(100, project.progress + progressDelta);
    if (project.progress >= 100) project.status = 'completed';
    return update;
  }

  // ---------- Investors ----------
  createInvestor(data: {
    name: string; email: string; password?: string; documentId?: string; documentIdType?: string;
    phone?: string; occupation?: string; country?: string; investmentExperience?: string;
    investmentFrequency?: string; investmentBudget?: number; riskProfile?: Investor['riskProfile'];
    bankAccount?: string; paymentMethod?: string; termsAccepted?: boolean; riskAcknowledgment?: boolean;
  }): Investor {
    if (this.findInvestorByEmail(data.email)) throw new Error('Ya existe una cuenta de inversionista con ese correo');
    if (!data.termsAccepted) throw new Error('Debe aceptar los términos y condiciones');
    if (!data.riskAcknowledgment) throw new Error('Debe reconocer los riesgos de inversión');
    
    const investor: Investor = {
      id: uuid(),
      name: data.name,
      email: data.email,
      password: data.password || '',
      documentId: data.documentId || '',
      documentIdType: (data.documentIdType as 'DNI' | 'CE' | 'PASSPORT') || 'DNI',
      phone: data.phone || '',
      occupation: data.occupation || '',
      country: data.country || 'PE',
      investmentExperience: (data.investmentExperience as 'none' | 'basic' | 'intermediate' | 'advanced') || 'none',
      investmentFrequency: (data.investmentFrequency as 'monthly' | 'quarterly' | 'annual' | 'sporadic') || 'sporadic',
      investmentBudget: data.investmentBudget || 0,
      riskProfile: data.riskProfile || 'moderado',
      bankAccount: data.bankAccount || '',
      paymentMethod: (data.paymentMethod as 'bank_transfer' | 'wallet' | 'credit_card') || 'bank_transfer',
      walletBalance: Math.max(5000, data.investmentBudget || 0),
      termsAccepted: data.termsAccepted || false,
      riskAcknowledgment: data.riskAcknowledgment || false,
      verified: false,
      createdAt: new Date(),
    };
    this.investors.set(investor.id, investor);
    return investor;
  }

  getInvestor(id: string): Investor | undefined {
    return this.investors.get(id);
  }

  verifyInvestor(id: string, data: { documentId?: string; phone?: string; bankAccount?: string } = {}): Investor | undefined {
    const investor = this.investors.get(id);
    if (!investor) return undefined;
    if (data.documentId) investor.documentId = String(data.documentId);
    if (data.phone) investor.phone = String(data.phone);
    if (data.bankAccount) investor.bankAccount = String(data.bankAccount);
    investor.verified = true;
    return investor;
  }

  findInvestorByEmail(email: string): Investor | undefined {
    return Array.from(this.investors.values()).find(i => i.email.toLowerCase() === email.toLowerCase());
  }

  loginInvestor(email: string, password: string): Investor | undefined {
    const investor = this.findInvestorByEmail(email);
    if (!investor || investor.password !== password) return undefined;
    return investor;
  }

  // ---------- Allies / associations ----------
  createAlly(data: { name: string; email: string; password?: string; organization?: string; phone?: string; country?: string; roleDescription?: string; termsAccepted?: boolean }): Ally {
    if (this.findAllyByEmail(data.email)) throw new Error('Ya existe una cuenta de aliado con ese correo');
    if (!data.termsAccepted) throw new Error('Debe aceptar los términos y condiciones');
    const ally: Ally = {
      id: uuid(), name: data.name, email: data.email, password: data.password || '',
      organization: data.organization || '', phone: data.phone || '', country: data.country || 'PE',
      roleDescription: data.roleDescription || '', termsAccepted: true, verified: false, createdAt: new Date(),
    };
    this.allies.set(ally.id, ally); return ally;
  }

  getAlly(id: string): Ally | undefined { return this.allies.get(id); }
  findAllyByEmail(email: string): Ally | undefined { return Array.from(this.allies.values()).find(a => a.email.toLowerCase() === email.toLowerCase()); }
  loginAlly(email: string, password: string): Ally | undefined { const ally = this.findAllyByEmail(email); if (!ally || ally.password !== password) return undefined; return ally; }
  verifyAlly(id: string): Ally | undefined { const ally = this.allies.get(id); if (!ally) return undefined; ally.verified = true; return ally; }
  getAllyDashboard(allyId: string) {
    const ally = this.allies.get(allyId); if (!ally) return undefined;
    const projects = Array.from(this.projects.values());
    const farmers = Array.from(this.farmers.values());
    return {
      ally,
      producersSupported: farmers.length,
      campaignsUnderReview: projects.filter(p => p.status === 'draft').length,
      publishedCampaigns: projects.filter(p => p.status !== 'draft').length,
      queue: projects.map(p => ({
        project: p, farmer: this.farmers.get(p.farmerId),
        risk: buildRiskAssessment(p, this.farmers.get(p.farmerId)),
      }))
    };
  }

  // ---------- Investments ----------
  invest(investorId: string, projectId: string, amount: number): Investment {
    const investor = this.investors.get(investorId);
    if (!investor) throw new Error('Investor not found');
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');
    if (!investor.verified) throw new Error('Debes completar la verificación del inversionista antes de invertir');
    if (amount <= 0) throw new Error('Amount must be positive');
    if (amount > investor.walletBalance) throw new Error('Insufficient wallet balance');

    const token = this.tokens.get(projectId);
    if (!token) throw new Error('Token not found');
    const remaining = project.investmentNeeded - project.amountRaised;
    if (amount > remaining) throw new Error('Amount exceeds remaining funding needed');

    const tokensToAcquire = Number((amount / token.price).toFixed(4));
    const expectedReturn = Number((amount * (1 + project.expectedReturnPct / 100)).toFixed(2));

    const investment: Investment = {
      id: uuid(), investorId, projectId, amount, tokensAcquired: tokensToAcquire, expectedReturn, createdAt: new Date(),
    };
    this.investments.set(investment.id, investment);

    token.circulating += tokensToAcquire;
    project.amountRaised += amount;
    if (project.amountRaised >= project.investmentNeeded) project.status = 'funded';
    investor.walletBalance -= amount;

    return investment;
  }

  getInvestorPortfolio(investorId: string) {
    const investments = Array.from(this.investments.values()).filter(i => i.investorId === investorId);
    const enriched = investments.map(inv => ({ ...inv, project: this.projects.get(inv.projectId) }));
    const totalInvested = investments.reduce((s, i) => s + i.amount, 0);
    const totalExpectedReturn = investments.reduce((s, i) => s + i.expectedReturn, 0);
    const projectsFunded = new Set(investments.map(i => i.projectId)).size;
    return { investments: enriched, totalInvested, totalExpectedReturn, projectsFunded };
  }

  // ---------- Farmer dashboard ----------
  getFarmerDashboard(farmerId: string) {
    const farmer = this.farmers.get(farmerId);
    if (!farmer) return undefined;
    const projects = Array.from(this.projects.values()).filter(p => p.farmerId === farmerId);
    const totalRaised = projects.reduce((s, p) => s + p.amountRaised, 0);
    const projectsWithUpdates = projects.map(p => ({ ...p, updates: this.updates.get(p.id) || [] }));
    return { farmer, projects: projectsWithUpdates, totalRaised, activeProjects: projects.filter(p => p.status === 'active').length };
  }

  // ---------- Platform stats ----------
  getStats(): DashboardStats {
    return {
      totalProjects: this.projects.size,
      totalFunded: Array.from(this.projects.values()).reduce((s, p) => s + p.amountRaised, 0),
      totalInvestors: this.investors.size,
      totalFarmers: this.farmers.size,
    };
  }

  // ---------- Seed demo data ----------
  private seed() {
    const f1 = this.createFarmer({ name: 'Rosa Quispe Mamani', email: 'rosa.quispe@agervest.pe', password: 'demo123', phone: '951234567', location: 'Puno, Perú', cropType: 'Quinua', areaHa: 4.5, documentId: '41234567', bankAccount: '191-0012345-0-01', paymentMethod: 'bank_transfer', yearsExperience: 9, agriculturalCertified: true, termsAccepted: true });
    this.validateFarmer(f1.id);
    const f2 = this.createFarmer({ name: 'Julio Ttito Ccama', email: 'julio.ttito@agervest.pe', password: 'demo123', phone: '952345678', location: 'Cusco, Perú', cropType: 'Cafe', areaHa: 6, documentId: '43456789', bankAccount: '194-0023456-0-02', paymentMethod: 'bank_transfer', yearsExperience: 4, agriculturalCertified: false, termsAccepted: true });
    this.validateFarmer(f2.id);
    const f3 = this.createFarmer({ name: 'Estefany Choque Loayza', email: 'estefany.choque@agervest.pe', password: 'demo123', phone: '953456789', location: 'Arequipa, Perú', cropType: 'Palta', areaHa: 8.2, documentId: '45678901', bankAccount: '193-0034567-0-03', paymentMethod: 'bank_transfer', yearsExperience: 12, agriculturalCertified: true, termsAccepted: true });
    this.validateFarmer(f3.id);
    const f4 = this.createFarmer({ name: 'Marco Huaman Rios', email: 'marco.huaman@agervest.pe', password: 'demo123', phone: '954567890', location: 'Ica, Perú', cropType: 'Uva', areaHa: 5, documentId: '47890123', bankAccount: '195-0045678-0-04', paymentMethod: 'bank_transfer', yearsExperience: 2, agriculturalCertified: false, termsAccepted: true });
    this.validateFarmer(f4.id);

    const p1 = this.createProject({ farmerId: f1.id, title: 'Ampliación de cultivo de quinua orgánica', crop: 'Quinua', description: 'Ampliación de 4.5 a 8 hectáreas de quinua orgánica certificada para exportación, con sistema de riego tecnificado.', location: 'Puno, Perú', projectAreaHa: 8, cropVariety: 'Quinua real blanca', investmentNeeded: 18000, duration: 8, risk: 'medio', expectedReturnPct: 15, objectives: 'Duplicar el área cultivada y obtener certificación orgánica internacional.', benefits: 'Acceso a mercados de exportación con precios premium.', riskMitigation: 'Riego tecnificado para reducir dependencia de lluvias y monitoreo de heladas con alertas locales.', hasInsurance: 'yes', priorExperience: 'yes', certification: 'organic', technicalSupport: 'agro_company', termsAccepted: true, updatesAccepted: true });
    p1.featured = true; p1.amountRaised = 0; p1.status = 'active';
    this.addProjectUpdate(p1.id, 'Preparación de terreno y análisis de suelo completado.', 15);

    const p2 = this.createProject({ farmerId: f2.id, title: 'Renovación de cafetales de altura', crop: 'Cafe', description: 'Renovación de 3 hectáreas de cafetales con variedades resistentes a la roya, mejorando productividad y calidad de taza.', location: 'Cusco, Perú', projectAreaHa: 3, cropVariety: 'Caturra / Catimor', investmentNeeded: 25000, duration: 12, risk: 'medio', expectedReturnPct: 18, objectives: 'Incrementar rendimiento en 40% y mejorar puntaje de calidad SCA.', benefits: 'Café de especialidad con mejor precio en mercado internacional.', riskMitigation: 'Variedades resistentes a roya y manejo integrado de plagas.', hasInsurance: 'planning', priorExperience: 'assisted', certification: 'in_transition', technicalSupport: 'contractor', termsAccepted: true, updatesAccepted: true });
    p2.featured = true;
    this.addProjectUpdate(p2.id, 'Vivero de plantones establecido, 2000 plantines en crecimiento.', 20);

    const p3 = this.createProject({ farmerId: f3.id, title: 'Palto Hass para exportación', crop: 'Palta', description: 'Instalación de sistema de riego por goteo y fertirriego en 6 hectáreas de palto Hass orientado a exportación.', location: 'Arequipa, Perú', projectAreaHa: 6, cropVariety: 'Hass', investmentNeeded: 32000, duration: 10, risk: 'bajo', expectedReturnPct: 12, objectives: 'Certificación GlobalGAP y contrato de exportación asegurado.', benefits: 'Demanda internacional estable y precios competitivos.', riskMitigation: 'Riego por goteo tecnificado y contrato de exportación ya firmado antes del inicio.', hasInsurance: 'yes', priorExperience: 'yes', certification: 'organic', technicalSupport: 'agro_company', termsAccepted: true, updatesAccepted: true });
    p3.featured = true;
    this.addProjectUpdate(p3.id, 'Sistema de riego por goteo instalado en 40% del área.', 25);

    const p4 = this.createProject({ farmerId: f4.id, title: 'Vid de mesa Red Globe', crop: 'Uva', description: 'Ampliación de parral y sistema antigranizo para 5 hectáreas de uva Red Globe destinada a exportación.', location: 'Ica, Perú', projectAreaHa: 5, cropVariety: 'Red Globe', investmentNeeded: 40000, duration: 14, risk: 'alto', expectedReturnPct: 22, objectives: 'Ampliar producción en 60% con protección climática.', benefits: 'Alta rentabilidad por precios de exportación en temporada.', riskMitigation: 'Instalación de malla antigranizo; aún en proceso, no cubre el 100% del área.', hasInsurance: 'no', priorExperience: 'new', certification: 'conventional', technicalSupport: 'own_experience', termsAccepted: true, updatesAccepted: true });
    this.addProjectUpdate(p4.id, 'Compra de materiales para malla antigranizo en proceso.', 5);

    this.createAlly({ name: 'Asociación Agraria Sur Andina', email: 'aliado@agervest.pe', password: 'Demo1234', organization: 'Cooperativa Sur Andina', phone: '999888777', country: 'PE', roleDescription: 'Acompañamiento y validación de campañas agrícolas', termsAccepted: true });

    const i1 = this.createInvestor({ name: 'Daniela Fernández', email: 'daniela.fernandez@mail.com', password: 'demo123', documentId: '70123456', phone: '987654321', occupation: 'Ingeniera', investmentBudget: 10000, riskProfile: 'moderado', bankAccount: '002-1234567-8-09', paymentMethod: 'bank_transfer', termsAccepted: true, riskAcknowledgment: true });
    const i2 = this.createInvestor({ name: 'Carlos Medina', email: 'carlos.medina@mail.com', password: 'demo123', documentId: '71234567', phone: '976543210', occupation: 'Contador', investmentBudget: 20000, riskProfile: 'conservador', bankAccount: '003-7654321-8-10', paymentMethod: 'bank_transfer', termsAccepted: true, riskAcknowledgment: true });
    this.verifyInvestor(i1.id); this.verifyInvestor(i2.id);
    this.invest(i1.id, p1.id, 3000);
    this.invest(i1.id, p3.id, 5000);
    this.invest(i2.id, p2.id, 4000);
  }
}
