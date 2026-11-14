export type UserRole = 'farmer' | 'investor' | 'ally' | 'admin';
export type ProjectRisk = 'bajo' | 'medio' | 'alto';
export type ProjectStatus = 'draft' | 'active' | 'funded' | 'in_progress' | 'completed' | 'cancelled';
export type RiskProfile = 'conservador' | 'moderado' | 'agresivo';

export interface UserBase {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone: string | null;
  country: string | null;
  verified: boolean;
  termsAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Farmer extends UserBase {
  role: 'farmer';
  location: string;
  cropType: string;
  areaHa: number;
  documentId: string;
  documentUrl: string | null;
  yearsExperience: number;
  certifications: string[];
  bankAccount: string;
  paymentMethod: 'bank_transfer' | 'wallet' | 'other';
  agriculturalCertified: boolean;
  validated: boolean;
  trustScore: number;
  avatarSeed: string | null;
  walletBalance: number;
}

export type TransactionType = 'investment' | 'return' | 'deposit' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'cancelled';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  fromUserId: string | null;
  fromUserName: string | null;
  toUserId: string | null;
  toUserName: string | null;
  projectId: string | null;
  projectTitle: string | null;
  investmentId: string | null;
  amount: number;
  description: string | null;
  scheduledFor: Date | null;
  createdAt: Date;
  completedAt: Date | null;
  direction: 'in' | 'out' | 'other';
}

export interface PendingReturn {
  transactionId: string;
  projectId: string | null;
  projectTitle: string | null;
  investmentId: string | null;
  amount: number;
  scheduledFor: Date;
  daysRemaining: number;
}

export interface PendingObligation {
  transactionId: string;
  projectId: string | null;
  projectTitle: string | null;
  investorId: string | null;
  investorName: string | null;
  amount: number;
  scheduledFor: Date;
  daysUntilDue: number;
}

export interface Investor extends UserBase {
  role: 'investor';
  documentId: string | null;
  documentIdType: 'DNI' | 'CE' | 'PASSPORT';
  occupation: string | null;
  investmentExperience: 'none' | 'basic' | 'intermediate' | 'advanced';
  investmentFrequency: 'monthly' | 'quarterly' | 'annual' | 'sporadic';
  investmentBudget: number;
  riskProfile: RiskProfile;
  bankAccount: string | null;
  paymentMethod: 'bank_transfer' | 'wallet' | 'credit_card';
  walletBalance: number;
  riskAcknowledgment: boolean;
}

export interface Ally extends UserBase {
  role: 'ally';
  organization: string;
  roleDescription: string | null;
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
  durationMonths: number;
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
  imageUrl: string | null;
  documentUrl: string | null;
  status: ProjectStatus;
  progress: number;
  featured: boolean;
  termsAccepted: boolean;
  updatesAccepted: boolean;
  createdAt: Date;
  updatedAt: Date;
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

export interface ProjectUpdate {
  id: string;
  projectId: string;
  message: string;
  progressDelta: number;
  imageUrl: string | null;
  createdAt: Date;
}

export interface RiskFactor {
  label: string;
  explanation: string;
  weightPct: number;
  valueScore: number;
  contribution: number;
}

export interface RiskAssessment {
  declaredRisk: ProjectRisk;
  computedRisk: ProjectRisk;
  riskScorePct: number;
  consistent: boolean;
  factors: RiskFactor[];
  note: string;
}
