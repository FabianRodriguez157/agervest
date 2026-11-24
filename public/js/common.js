// Respeta window.AGV_CONFIG.apiBase (ver js/config.js) para separar frontend/backend.
function _agvUrl(path) {
  const prefix = (window.AGV_CONFIG && window.AGV_CONFIG.apiBase) || '';
  const normalized = path.startsWith('/') ? path : '/' + path;
  return prefix ? prefix.replace(/\/$/, '') + normalized : normalized;
}
function _agvCreds() {
  return (window.AGV_CONFIG && window.AGV_CONFIG.apiBase) ? 'include' : 'same-origin';
}
const API = {
  async get(url) {
    const r = await fetch(_agvUrl(url), { credentials: _agvCreds() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error de red');
    return data;
  },
  async post(url, body) {
    const r = await fetch(_agvUrl(url), { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: _agvCreds(), body: JSON.stringify(body) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Error de red');
    return data;
  },
};

function fmtMoney(n) { return 'S/ ' + Number(n || 0).toLocaleString('es-PE', { maximumFractionDigits: 0 }); }
function fmtDate(d) { return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }); }
function initials(name) { return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase(); }
function riskLabel(r) { return { bajo: 'Riesgo bajo', medio: 'Riesgo medio', alto: 'Riesgo alto' }[r] || r; }
function statusLabel(s) { return { active: 'Activo', funded: 'Financiado', in_progress: 'En curso', completed: 'Completado', draft: 'Borrador' }[s] || s; }

// The browser copy is only for UI state. The server-side HttpOnly cookie is authoritative.
const Session = {
  get investorId() { return localStorage.getItem('agv_investor_id'); },
  get farmerId() { return localStorage.getItem('agv_farmer_id'); },
  get allyId() { return localStorage.getItem('agv_ally_id'); },
  get role() { return localStorage.getItem('agv_role'); },
  get name() { return localStorage.getItem('agv_name'); },
  setInvestor(id, name) {
    localStorage.removeItem('agv_farmer_id');
    localStorage.removeItem('agv_ally_id');
    localStorage.setItem('agv_investor_id', id);
    localStorage.setItem('agv_role', 'investor');
    if (name) localStorage.setItem('agv_name', name);
  },
  setFarmer(id, name) {
    localStorage.removeItem('agv_investor_id');
    localStorage.removeItem('agv_ally_id');
    localStorage.setItem('agv_farmer_id', id);
    localStorage.setItem('agv_role', 'farmer');
    if (name) localStorage.setItem('agv_name', name);
  },
  setAlly(id, name) {
    localStorage.removeItem('agv_investor_id');
    localStorage.removeItem('agv_farmer_id');
    localStorage.setItem('agv_ally_id', id);
    localStorage.setItem('agv_role', 'ally');
    if (name) localStorage.setItem('agv_name', name);
  },
  setAdmin(id, name) {
    localStorage.removeItem('agv_investor_id');
    localStorage.removeItem('agv_farmer_id');
    localStorage.removeItem('agv_ally_id');
    localStorage.setItem('agv_admin_id', id);
    localStorage.setItem('agv_role', 'admin');
    if (name) localStorage.setItem('agv_name', name);
  },
  clearLocal() {
    localStorage.removeItem('agv_investor_id');
    localStorage.removeItem('agv_farmer_id');
    localStorage.removeItem('agv_ally_id');
    localStorage.removeItem('agv_admin_id');
    localStorage.removeItem('agv_role');
    localStorage.removeItem('agv_name');
  },
  async logout() {
    try { await API.post('/api/auth/logout', {}); } catch (_) {}
    this.clearLocal();
    window.location.href = 'index.html';
  },
};

function renderNavbar(active) {
  const el = document.getElementById('navbar');
  if (!el) return;
  const loggedIn = ['farmer', 'investor', 'ally', 'admin'].includes(Session.role);
  const dashHref = Session.role === 'farmer' ? 'farmer-dashboard.html'
                 : Session.role === 'investor' ? 'investor-dashboard.html'
                 : Session.role === 'ally' ? 'ally-dashboard.html'
                 : 'admin-dashboard.html';
  const dashboardLink = Session.role === 'farmer'
    ? `<a href="farmer-dashboard.html" class="${active === 'farmer-dash' ? 'active' : ''}">Panel agricultor</a>`
    : Session.role === 'investor'
      ? `<a href="investor-dashboard.html" class="${active === 'investor-dash' ? 'active' : ''}">Panel inversionista</a>`
      : Session.role === 'ally'
        ? `<a href="ally-dashboard.html" class="${active === 'ally-dash' ? 'active' : ''}">Panel aliado</a>`
        : Session.role === 'admin'
          ? `<a href="admin-dashboard.html" class="${active === 'admin-dash' ? 'active' : ''}">Panel admin</a>`
          : '';
  const sessionArea = loggedIn
    ? `<div class="nav-cta"><a href="${dashHref}" class="btn btn-outline btn-sm"><i data-lucide="user" class="icon-inline"></i> ${Session.name || 'Mi panel'}</a><button class="btn btn-primary btn-sm" onclick="Session.logout()">Salir</button></div>`
    : `<div class="nav-cta"><a href="login.html" class="btn btn-outline btn-sm">Iniciar sesión</a><a href="register-project.html" class="btn btn-primary btn-sm">Publicar proyecto</a></div>`;
  el.innerHTML = `<div class="topbar-inner"><a class="brand" href="index.html"><img src="img/logo.png" alt="AgerVest" class="brand-logo"> AgerVest</a><div class="nav-links"><a href="index.html" class="${active === 'home' ? 'active' : ''}">Inicio</a><a href="catalog.html" class="${active === 'catalog' ? 'active' : ''}">Oportunidades</a>${dashboardLink}</div>${sessionArea}</div>`;
  if (window.lucide) window.lucide.createIcons();
}

function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;
  el.innerHTML = `<div class="container footer-enhanced"><div>© ${new Date().getFullYear()} AgerVest — Financia historias que alimentan al país.</div><div class="footer-links"><button type="button" class="footer-legal-link" onclick="openLegalModal('terms')">Términos</button><button type="button" class="footer-legal-link" onclick="openLegalModal('privacy')">Privacidad</button><button type="button" class="footer-legal-link" onclick="openLegalModal('risk')">Aviso de riesgos</button><span>Prototipo académico · UCSM Ing. de Sistemas</span></div></div>`;
}

function renderIcons() { if (window.lucide) window.lucide.createIcons(); }
document.addEventListener('DOMContentLoaded', () => {
  renderFooter();
  renderIcons();
  // Auto-render icons when dynamic content is injected
  const obs = new MutationObserver(() => {
    if (document.querySelector('[data-lucide]')) renderIcons();
  });
  obs.observe(document.body, { childList: true, subtree: true });
});


// ---------- Legal information (registration prototype) ----------
const LEGAL_CONTENT = {
  terms: {
    title: 'Términos y condiciones',
    html: `
      <h4>1. Naturaleza del servicio</h4>
      <p>AgerVest es un prototipo académico de una plataforma digital orientada a conectar proyectos agrícolas con potenciales inversionistas. En esta versión, las operaciones y saldos mostrados son demostrativos y no constituyen una oferta pública de valores ni una invitación a realizar depósitos o transferencias reales.</p>
      <h4>2. Registro y veracidad</h4>
      <p>El usuario se compromete a proporcionar información exacta, actualizada y verificable, y a mantener la confidencialidad de sus credenciales. No está permitido crear cuentas suplantando a terceros ni utilizar información falsa.</p>
      <h4>3. Proyectos agrícolas</h4>
      <p>La publicación de un proyecto no implica que AgerVest garantice su ejecución, rentabilidad, recuperación del capital o cumplimiento de las obligaciones del agricultor. La información de cada proyecto debe ser evaluada antes de cualquier decisión.</p>
      <h4>4. Inversiones y simulaciones</h4>
      <p>Los porcentajes de retorno, tokens, saldos y resultados mostrados en el prototipo son referenciales. Una simulación no garantiza resultados futuros. En una eventual versión operativa, las condiciones, contratos, límites, mecanismos de protección y autorizaciones aplicables deberán definirse conforme al marco regulatorio correspondiente.</p>
      <h4>5. Uso permitido</h4>
      <p>El usuario debe utilizar la plataforma de forma lícita, respetando los derechos de terceros y sin intentar alterar, vulnerar o acceder a información o cuentas ajenas.</p>
      <h4>6. Suspensión y cambios</h4>
      <p>La cuenta podrá ser suspendida en caso de uso fraudulento, información falsa o incumplimiento de estas condiciones. Los términos pueden actualizarse cuando cambien el prototipo, sus funcionalidades o las obligaciones legales aplicables.</p>
      <h4>7. Legislación aplicable</h4>
      <p>Para una versión comercial destinada al Perú, los términos deberán revisarse y adecuarse a la legislación peruana aplicable y a la actividad concreta que se pretenda desarrollar.</p>
      <div class="legal-source">Documento informativo del prototipo. No reemplaza asesoría legal profesional.</div>`
  },
  privacy: {
    title: 'Política de privacidad y protección de datos',
    html: `
      <h4>1. Datos que se solicitan</h4>
      <p>Según el tipo de cuenta, el prototipo puede solicitar nombre, correo, teléfono, ubicación, documento de identidad, información agrícola, ocupación, experiencia de inversión y datos relacionados con medios de pago.</p>
      <h4>2. Finalidades</h4>
      <p>Los datos se utilizan para crear y gestionar la cuenta, validar perfiles, mostrar información asociada a proyectos, administrar las funcionalidades del prototipo y mantener la seguridad del servicio.</p>
      <h4>3. Confidencialidad y seguridad</h4>
      <p>La información debe tratarse aplicando medidas de seguridad adecuadas y limitando el acceso a las personas o servicios que lo necesiten para las finalidades informadas. Esta versión es un prototipo académico y no debe utilizarse para almacenar datos financieros reales o documentos sensibles en producción.</p>
      <h4>4. Derechos del titular</h4>
      <p>Las personas titulares de datos cuentan con los derechos reconocidos por la normativa peruana de protección de datos personales, incluyendo los mecanismos de acceso, rectificación, cancelación y oposición, según corresponda.</p>
      <h4>5. Conservación y terceros</h4>
      <p>En una versión productiva deberán definirse los plazos de conservación, encargados del tratamiento, transferencias y demás condiciones aplicables, e informarse al titular de forma transparente.</p>
      <h4>6. Responsable y contacto</h4>
      <p>Antes de poner la plataforma en producción deberá identificarse expresamente al responsable del tratamiento y habilitarse un canal de atención para solicitudes de privacidad.</p>
      <div class="legal-source">El contenido toma como referencia la Ley N.° 29733 y su Reglamento aprobado por Decreto Supremo N.° 016-2024-JUS. Documento informativo del prototipo; debe ser revisado antes de un uso real.</div>`
  },
  risk: {
    title: 'Aviso de riesgos de inversión',
    html: `
      <h4>1. El capital está sujeto a riesgo</h4>
      <p>La inversión en proyectos agrícolas puede generar pérdidas parciales o totales. El retorno esperado mostrado por la plataforma no constituye una promesa ni una garantía.</p>
      <h4>2. Riesgos del proyecto</h4>
      <ul>
        <li>Riesgo climático y eventos naturales.</li>
        <li>Riesgo productivo, sanitario y operativo.</li>
        <li>Variación de precios y demanda de productos agrícolas.</li>
        <li>Retrasos, incumplimiento o menor producción.</li>
        <li>Riesgo de liquidez y dificultad para recuperar el capital antes del plazo previsto.</li>
      </ul>
      <h4>3. Evaluación antes de invertir</h4>
      <p>El inversionista debe revisar la información disponible, el nivel de riesgo, las condiciones del proyecto, el plazo y los escenarios de pérdida. El indicador de riesgo de AgerVest es una herramienta informativa y no elimina la incertidumbre.</p>
      <h4>4. Sin asesoría financiera personalizada</h4>
      <p>El contenido del prototipo no constituye recomendación financiera, tributaria o legal personalizada. Cada persona debe tomar sus propias decisiones y, cuando corresponda, buscar asesoría profesional.</p>
      <h4>5. Estado del prototipo</h4>
      <p>Esta versión es académica. Las operaciones, tokens, saldos y retornos mostrados son demostrativos y no deben interpretarse como dinero real ni como una oferta de inversión.</p>
      <div class="legal-source">La regulación peruana contempla un marco específico para el financiamiento participativo financiero y su administración por sociedades autorizadas por la SMV. Antes de una operación real debe determinarse jurídicamente si el modelo propuesto queda comprendido en dicho marco y obtenerse las autorizaciones que correspondan.</div>`
  }
};
LEGAL_CONTENT.legal = { title: 'Aviso legal', html: LEGAL_CONTENT.risk.html };


function openLegalModal(type) {
  const item = LEGAL_CONTENT[type];
  if (!item) return;
  closeLegalModal();
  const modal = document.createElement('div');
  modal.id = 'legalModal';
  modal.className = 'legal-modal open';
  modal.innerHTML = `<div class="legal-modal-card" role="dialog" aria-modal="true" aria-labelledby="legalModalTitle">
    <div class="legal-modal-head">
      <h3 id="legalModalTitle">${item.title}</h3>
      <button class="legal-close" type="button" aria-label="Cerrar" onclick="closeLegalModal()">×</button>
    </div>
    <div class="legal-modal-body">${item.html}</div>
  </div>`;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeLegalModal(); });
  document.body.appendChild(modal);
  document.addEventListener('keydown', legalEscapeHandler);
}
function closeLegalModal() {
  document.getElementById('legalModal')?.remove();
  document.removeEventListener('keydown', legalEscapeHandler);
}
function legalEscapeHandler(e) {
  if (e.key === 'Escape') closeLegalModal();
}
