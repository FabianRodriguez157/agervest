import { Farmer, Project, ProjectRisk, RiskAssessment, RiskFactor } from '../types';

export const RISK_WEIGHTS = {
  clima: 25, seguro: 20, experiencia: 15, soporte: 15,
  certificacion: 10, confianza: 10, duracion: 5,
} as const;

export function buildRiskAssessment(project: Project, farmer: Farmer | null): RiskAssessment {
  const factors: RiskFactor[] = [];
  const push = (label: string, weightPct: number, valueScore: number, explanation: string) => {
    const v = Math.max(0, Math.min(100, valueScore));
    factors.push({ label, weightPct, valueScore: v, contribution: Number((weightPct / 100 * v).toFixed(2)), explanation });
  };

  const cropScore: Record<string, number> = { quinua: 20, cafe: 55, palta: 20, uva: 90, papa: 40 };
  const cs = cropScore[project.crop.toLowerCase()] ?? 55;
  push('Exposición climática del cultivo', RISK_WEIGHTS.clima, cs,
    `Cultivo "${project.crop}": nivel de exposición climática histórica = ${cs}/100.`);

  const seguroScore = project.hasInsurance === 'yes' ? 10 : project.hasInsurance === 'planning' ? 50 : 90;
  push('Cobertura de seguro agrícola', RISK_WEIGHTS.seguro, seguroScore,
    project.hasInsurance === 'yes' ? 'Seguro agrícola contratado.' :
    project.hasInsurance === 'planning' ? 'Seguro agrícola en trámite.' :
    'Sin seguro agrícola.');

  const expScore = project.priorExperience === 'yes' ? 15 : project.priorExperience === 'assisted' ? 50 : 90;
  push('Experiencia previa del agricultor', RISK_WEIGHTS.experiencia, expScore,
    project.priorExperience === 'yes' ? 'Experiencia previa directa.' :
    project.priorExperience === 'assisted' ? 'Asistencia técnica compensa experiencia.' :
    'Primera vez con este tipo de proyecto.');

  const supScore = (project.technicalSupport === 'government' || project.technicalSupport === 'agro_company') ? 15
    : project.technicalSupport === 'contractor' ? 45 : 75;
  push('Soporte técnico del proyecto', RISK_WEIGHTS.soporte, supScore,
    supScore === 15 ? 'Entidad del Estado o agroexportadora.' :
    supScore === 45 ? 'Técnico/consultor contratado.' :
    'Depende de la experiencia propia.');

  const certScore = (project.certification === 'organic' || project.certification === 'fair_trade') ? 20
    : project.certification === 'in_transition' ? 55 : 70;
  push('Certificación del producto', RISK_WEIGHTS.certificacion, certScore,
    `Certificación: ${project.certification}.`);

  const confScore = !farmer ? 90 : !farmer.validated ? 90 : Math.max(0, 100 - farmer.trustScore);
  push('Confianza del agricultor validado', RISK_WEIGHTS.confianza, confScore,
    !farmer || !farmer.validated ? 'Agricultor aún no validado.' :
    `Validado con trust score ${farmer.trustScore}/100.`);

  const durScore = project.durationMonths >= 12 ? 70 : project.durationMonths >= 6 ? 40 : 20;
  push('Duración del proyecto', RISK_WEIGHTS.duracion, durScore,
    `${project.durationMonths} meses de exposición.`);

  const riskScorePct = Number(factors.reduce((s, f) => s + f.contribution, 0).toFixed(1));
  const computedRisk: ProjectRisk = riskScorePct <= 33 ? 'bajo' : riskScorePct <= 66 ? 'medio' : 'alto';
  const consistent = computedRisk === project.risk;
  const note = consistent
    ? `El riesgo declarado ("${project.risk}") coincide con el puntaje calculado de ${riskScorePct}%.`
    : `Declarado "${project.risk}", calculado "${computedRisk}" (${riskScorePct}%). Revisa los factores.`;

  return { declaredRisk: project.risk, computedRisk, riskScorePct, consistent, factors, note };
}
