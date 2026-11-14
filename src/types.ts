export interface Farmer {
  id: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  location: string;
  cropType: string;
  areaHa: number;
  documentId: string;
  documentUrl?: string;
  yearsExperience: number;
  certifications: string[];
  bankAccount: string;
  paymentMethod: 'bank_transfer' | 'wallet' | 'other';
  agriculturalCertified: boolean;
  validated: boolean;
  trustScore: number;
  avatarSeed: string;
  termsAccepted: boolean;
  createdAt: Date;
}

export type ProjectRisk = 'bajo' | 'medio' | 'alto';
export type ProjectStatus = 'draft' | 'active' | 'funded' | 'in_progress' | 'completed';

export interface ProjectUpdate {
  id: string;
  projectId: string;
  message: string;
  progressDelta: number;
  imageUrl?: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  farmerId: string;
  title: string;
  crop: string;
  description: string;
  location: string;
  projectAreaHa: number;
  cropVariety: string;
  investmentNeeded: number;
  amountRaised: number;
  amountAvailable: number;
  duration: number; // months
  risk: ProjectRisk;
  expectedReturnPct: number;
  paymentMethod: 'percentage' | 'fixed' | 'monthly' | 'harvest';
  objectives: string;
  benefits: string;
  riskMitigation: string;
  hasInsurance: 'yes' | 'planning' | 'no';
  priorExperience: 'yes' | 'assisted' | 'new';
  certification: 'organic' | 'conventional' | 'in_transition' | 'fair_trade' | 'other';
  technicalSupport: 'own_experience' | 'contractor' | 'government' | 'agro_company' | 'other';
  imageUrl: string;
  documentUrl?: string;
  status: ProjectStatus;
  progress: number; // 0-100
  featured: boolean;
  termsAccepted: boolean;
  updatesAccepted: boolean;
  createdAt: Date;
}

export interface Token {
  id: string;
  projectId: string;
  symbol: string;
  totalSupply: number;
  price: number;
  circulating: number;
}

export interface Investment {
  id: string;
  investorId: string;
  projectId: string;
  amount: number;
  tokensAcquired: number;
  expectedReturn: number;
  createdAt: Date;
}

export type RiskProfile = 'conservador' | 'moderado' | 'agresivo';

export interface Investor {
  id: string;
  name: string;
  email: string;
  password: string;
  documentId: string;
  documentIdType: 'DNI' | 'CE' | 'PASSPORT';
  phone: string;
  occupation: string;
  country: string;
  investmentExperience: 'none' | 'basic' | 'intermediate' | 'advanced';
  investmentBudget: number;
  investmentFrequency: 'monthly' | 'quarterly' | 'annual' | 'sporadic';
  riskProfile: RiskProfile;
  bankAccount: string;
  paymentMethod: 'bank_transfer' | 'wallet' | 'credit_card';
  walletBalance: number;
  termsAccepted: boolean;
  riskAcknowledgment: boolean;
  verified: boolean;
  createdAt: Date;
}

export interface Ally {
  id: string;
  name: string;
  email: string;
  password: string;
  organization: string;
  phone: string;
  country: string;
  roleDescription: string;
  termsAccepted: boolean;
  verified: boolean;
  createdAt: Date;
}

export type UserRole = 'farmer' | 'investor' | 'ally';

export interface RiskFactor {
  label: string;
  explanation: string;
  weightPct: number;      // peso del factor sobre el total (%), los pesos de todos los factores suman 100
  valueScore: number;     // qué tan riesgoso es este factor en particular, de 0 (mínimo) a 100 (máximo)
  contribution: number;   // weightPct/100 * valueScore — puntos que este factor aporta al puntaje final
}

export interface RiskAssessment {
  declaredRisk: ProjectRisk;
  computedRisk: ProjectRisk;
  riskScorePct: number;   // puntaje final 0-100: suma de las contribuciones de todos los factores
  consistent: boolean;
  factors: RiskFactor[];
  note: string;
}

export interface SeasonInfo {
  ciclo: string;
  siembra: string;
  cosecha: string;
  climaIdeal: string;
  riesgosClimaticos: string[];
  regionClima: string;
  regionRiesgos: string[];
}

export interface DashboardStats {
  totalProjects: number;
  totalFunded: number;
  totalInvestors: number;
  totalFarmers: number;
}
