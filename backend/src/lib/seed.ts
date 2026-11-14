import { closePool } from './db';
import { hashPassword } from './password';
import * as FarmersRepo from '../repositories/farmers.repo';
import * as InvestorsRepo from '../repositories/investors.repo';
import * as AlliesRepo from '../repositories/allies.repo';
import * as ProjectsRepo from '../repositories/projects.repo';
import * as ProjectsService from '../services/projects.service';
import * as InvestmentsService from '../services/investments.service';
import * as StatsRepo from '../repositories/stats.repo';

async function run() {
  console.log('Seeding AgerVest DB...');

  const existing = await StatsRepo.getUsersCount();
  if (existing > 0) {
    console.log(`Ya existen ${existing} usuarios — abortando seed (usa npm run db:reset primero)`);
    await closePool();
    return;
  }

  const demoHash = await hashPassword('demo123');
  const allyHash = await hashPassword('Demo1234');

  // --- Farmers ---
  const f1 = await FarmersRepo.create({ name: 'Rosa Quispe Mamani', email: 'rosa.quispe@agervest.pe', passwordHash: demoHash, phone: '951234567', location: 'Puno, Perú', cropType: 'Quinua', areaHa: 4.5, documentId: '41234567', bankAccount: '191-0012345-0-01', paymentMethod: 'bank_transfer', yearsExperience: 9, agriculturalCertified: true, termsAccepted: true });
  await FarmersRepo.markValidated(f1.id);

  const f2 = await FarmersRepo.create({ name: 'Julio Ttito Ccama', email: 'julio.ttito@agervest.pe', passwordHash: demoHash, phone: '952345678', location: 'Cusco, Perú', cropType: 'Cafe', areaHa: 6, documentId: '43456789', bankAccount: '194-0023456-0-02', paymentMethod: 'bank_transfer', yearsExperience: 4, agriculturalCertified: false, termsAccepted: true });
  await FarmersRepo.markValidated(f2.id);

  const f3 = await FarmersRepo.create({ name: 'Estefany Choque Loayza', email: 'estefany.choque@agervest.pe', passwordHash: demoHash, phone: '953456789', location: 'Arequipa, Perú', cropType: 'Palta', areaHa: 8.2, documentId: '45678901', bankAccount: '193-0034567-0-03', paymentMethod: 'bank_transfer', yearsExperience: 12, agriculturalCertified: true, termsAccepted: true });
  await FarmersRepo.markValidated(f3.id);

  const f4 = await FarmersRepo.create({ name: 'Marco Huaman Rios', email: 'marco.huaman@agervest.pe', passwordHash: demoHash, phone: '954567890', location: 'Ica, Perú', cropType: 'Uva', areaHa: 5, documentId: '47890123', bankAccount: '195-0045678-0-04', paymentMethod: 'bank_transfer', yearsExperience: 2, agriculturalCertified: false, termsAccepted: true });
  await FarmersRepo.markValidated(f4.id);

  // --- Projects + featured ---
  const p1 = await ProjectsService.createProject({ farmerId: f1.id, title: 'Ampliación de cultivo de quinua orgánica', crop: 'Quinua', description: 'Ampliación de 4.5 a 8 hectáreas de quinua orgánica certificada para exportación, con sistema de riego tecnificado.', location: 'Puno, Perú', projectAreaHa: 8, cropVariety: 'Quinua real blanca', investmentNeeded: 18000, durationMonths: 8, risk: 'medio', expectedReturnPct: 15, objectives: 'Duplicar el área cultivada y obtener certificación orgánica internacional.', benefits: 'Acceso a mercados de exportación con precios premium.', riskMitigation: 'Riego tecnificado para reducir dependencia de lluvias y monitoreo de heladas.', hasInsurance: 'yes', priorExperience: 'yes', certification: 'organic', technicalSupport: 'agro_company', termsAccepted: true, updatesAccepted: true });
  await ProjectsRepo.setFeatured(p1.id, true);
  await ProjectsRepo.addUpdate(p1.id, 'Preparación de terreno y análisis de suelo completado.', 15);

  const p2 = await ProjectsService.createProject({ farmerId: f2.id, title: 'Renovación de cafetales de altura', crop: 'Cafe', description: 'Renovación de 3 hectáreas de cafetales con variedades resistentes a la roya.', location: 'Cusco, Perú', projectAreaHa: 3, cropVariety: 'Caturra / Catimor', investmentNeeded: 25000, durationMonths: 12, risk: 'medio', expectedReturnPct: 18, objectives: 'Incrementar rendimiento en 40% y mejorar puntaje de calidad SCA.', benefits: 'Café de especialidad con mejor precio en mercado internacional.', riskMitigation: 'Variedades resistentes a roya y manejo integrado de plagas.', hasInsurance: 'planning', priorExperience: 'assisted', certification: 'in_transition', technicalSupport: 'contractor', termsAccepted: true, updatesAccepted: true });
  await ProjectsRepo.setFeatured(p2.id, true);
  await ProjectsRepo.addUpdate(p2.id, 'Vivero de plantones establecido, 2000 plantines en crecimiento.', 20);

  const p3 = await ProjectsService.createProject({ farmerId: f3.id, title: 'Palto Hass para exportación', crop: 'Palta', description: 'Instalación de sistema de riego por goteo y fertirriego en 6 hectáreas de palto Hass.', location: 'Arequipa, Perú', projectAreaHa: 6, cropVariety: 'Hass', investmentNeeded: 32000, durationMonths: 10, risk: 'bajo', expectedReturnPct: 12, objectives: 'Certificación GlobalGAP y contrato de exportación.', benefits: 'Demanda internacional estable.', riskMitigation: 'Riego por goteo y contrato de exportación firmado.', hasInsurance: 'yes', priorExperience: 'yes', certification: 'organic', technicalSupport: 'agro_company', termsAccepted: true, updatesAccepted: true });
  await ProjectsRepo.setFeatured(p3.id, true);
  await ProjectsRepo.addUpdate(p3.id, 'Sistema de riego por goteo instalado en 40% del área.', 25);

  const p4 = await ProjectsService.createProject({ farmerId: f4.id, title: 'Vid de mesa Red Globe', crop: 'Uva', description: 'Ampliación de parral y sistema antigranizo para 5 hectáreas de uva Red Globe.', location: 'Ica, Perú', projectAreaHa: 5, cropVariety: 'Red Globe', investmentNeeded: 40000, durationMonths: 14, risk: 'alto', expectedReturnPct: 22, objectives: 'Ampliar producción en 60% con protección climática.', benefits: 'Alta rentabilidad por precios de exportación.', riskMitigation: 'Instalación de malla antigranizo.', hasInsurance: 'no', priorExperience: 'new', certification: 'conventional', technicalSupport: 'own_experience', termsAccepted: true, updatesAccepted: true });
  await ProjectsRepo.addUpdate(p4.id, 'Compra de materiales para malla antigranizo en proceso.', 5);

  // --- Ally ---
  await AlliesRepo.create({ name: 'Asociación Agraria Sur Andina', email: 'aliado@agervest.pe', passwordHash: allyHash, phone: '999888777', country: 'PE', organization: 'Cooperativa Sur Andina', roleDescription: 'Acompañamiento y validación de campañas agrícolas', termsAccepted: true });

  // --- Investors ---
  const i1 = await InvestorsRepo.create({ name: 'Daniela Fernández', email: 'daniela.fernandez@mail.com', passwordHash: demoHash, documentId: '70123456', phone: '987654321', occupation: 'Ingeniera', investmentBudget: 10000, riskProfile: 'moderado', bankAccount: '002-1234567-8-09', paymentMethod: 'bank_transfer', termsAccepted: true, riskAcknowledgment: true });
  const i2 = await InvestorsRepo.create({ name: 'Carlos Medina', email: 'carlos.medina@mail.com', passwordHash: demoHash, documentId: '71234567', phone: '976543210', occupation: 'Contador', investmentBudget: 20000, riskProfile: 'conservador', bankAccount: '003-7654321-8-10', paymentMethod: 'bank_transfer', termsAccepted: true, riskAcknowledgment: true });
  await InvestorsRepo.verify(i1.id, {});
  await InvestorsRepo.verify(i2.id, {});

  // --- Investments (dinero real cambia de billetera inversor → agricultor) ---
  await InvestmentsService.invest(i1.id, p1.id, 3000);  // Daniela → Rosa (quinua)
  await InvestmentsService.invest(i1.id, p3.id, 5000);  // Daniela → Estefany (palta)
  await InvestmentsService.invest(i2.id, p2.id, 4000);  // Carlos → Julio (café)

  // --- Simula un retorno ya vencido y pagado (demo histórica) ---
  // Un cuarto proyecto corto para mostrar un ciclo completo cerrado
  const pDemo = await ProjectsService.createProject({
    farmerId: f1.id, title: 'Microciclo quinua temprana (cerrado)',
    crop: 'Quinua', description: 'Pequeño ciclo demostrativo ya cerrado para mostrar el flujo de retorno.',
    location: 'Puno, Perú', projectAreaHa: 0.5, cropVariety: 'Quinua rosada',
    investmentNeeded: 2000, durationMonths: 1, risk: 'bajo', expectedReturnPct: 10,
    objectives: 'Cerrar un ciclo completo para demo.',
    benefits: 'Demostración del flujo de retorno pagado.',
    riskMitigation: 'Ciclo corto, área pequeña, previamente ejecutado.',
    hasInsurance: 'yes', priorExperience: 'yes', certification: 'organic', technicalSupport: 'agro_company',
    termsAccepted: true, updatesAccepted: true,
  });
  await InvestmentsService.invest(i2.id, pDemo.id, 2000);  // Carlos invierte en demo
  // Liquida ya el proyecto demo para que el retorno aparezca cobrado
  const TxRepo = await import('../repositories/transactions.repo');
  await TxRepo.settleProject(pDemo.id);

  console.log('✓ Seed completo');
  console.log('  Agricultores: 4 (contraseña: demo123)');
  console.log('  Inversionistas: 2 (contraseña: demo123)');
  console.log('  Aliado: 1 — aliado@agervest.pe / Demo1234');
  console.log('  Proyectos: 5 (3 destacados, 1 cerrado con retorno pagado)');
  console.log('  Billeteras: dinero real movido inversor → agricultor en cada inversión');

  await closePool();
}

run().catch(err => { console.error(err); process.exit(1); });
