import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { AgerVestService } from './services';

type Role = 'farmer' | 'investor' | 'ally';
type Session = { id: string; role: Role; userId: string; name: string };

const app = express();
const service = new AgerVestService();
const sessions = new Map<string, Session>();
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.json());

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie || '';
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function getSession(req: Request): Session | undefined {
  const id = parseCookies(req).agv_session;
  return id ? sessions.get(id) : undefined;
}

function publicUser(user: any) {
  if (!user) return user;
  const { password: _password, ...safe } = user;
  return safe;
}

function setSession(res: Response, session: Session) {
  sessions.set(session.id, session);
  res.setHeader('Set-Cookie', `agv_session=${encodeURIComponent(session.id)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400`);
}

function clearSession(req: Request, res: Response) {
  const id = parseCookies(req).agv_session;
  if (id) sessions.delete(id);
  res.setHeader('Set-Cookie', 'agv_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0');
}

function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: 'Debes iniciar sesión' });
    if (session.role !== role) return res.status(403).json({ error: 'No tienes permisos para esta operación' });
    (req as any).session = session;
    next();
  };
}

// Protect the actual dashboard HTML files before express.static can serve them.
app.use((req, res, next) => {
  const protectedPages: Record<string, Role> = {
    '/farmer-dashboard.html': 'farmer',
    '/investor-dashboard.html': 'investor',
    '/ally-dashboard.html': 'ally',
  };
  const required = protectedPages[req.path];
  if (!required) return next();

  const session = getSession(req);
  if (!session) return res.redirect('/login.html');
  if (session.role !== required) {
    return res.redirect(session.role === 'farmer' ? '/farmer-dashboard.html' : '/investor-dashboard.html');
  }
  next();
});

app.use(express.static(PUBLIC_DIR));

// ---------- Session ----------
app.get('/api/auth/me', (req, res) => {
  const session = getSession(req);
  if (!session) return res.status(401).json({ error: 'No hay una sesión activa' });
  const user = session.role === 'farmer' ? service.getFarmer(session.userId) : session.role === 'investor' ? service.getInvestor(session.userId) : service.getAlly(session.userId);
  if (!user) return res.status(401).json({ error: 'La sesión ya no es válida' });
  res.json({ role: session.role, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ ok: true });
});

// ---------- Stats ----------
app.get('/api/stats', (_req, res) => res.json(service.getStats()));

// ---------- Farmers ----------
app.post('/api/farmers', (req, res) => {
  try { res.status(201).json(publicUser(service.createFarmer(req.body))); }
  catch (e) { res.status(400).json({ error: String(e) }); }
});

// Public catalog data only; individual farmer data is no longer publicly enumerable.
app.get('/api/farmers', (_req, res) => res.json(service.listFarmers().map(publicUser)));

app.get('/api/farmers/:id', (req, res) => {
  const farmer = service.getFarmer(req.params.id);
  if (!farmer) return res.status(404).json({ error: 'Farmer not found' });
  res.json(publicUser(farmer));
});

app.get('/api/farmers/:id/dashboard', requireRole('farmer'), (req, res) => {
  const session = (req as any).session as Session;
  if (session.userId !== req.params.id) return res.status(403).json({ error: 'No puedes acceder al panel de otro agricultor' });
  const dashboard = service.getFarmerDashboard(session.userId);
  if (!dashboard) return res.status(404).json({ error: 'Farmer not found' });
  res.json({ ...dashboard, farmer: publicUser(dashboard.farmer) });
});

// ---------- Projects ----------
app.post('/api/projects', requireRole('farmer'), (req, res) => {
  try {
    const session = (req as any).session as Session;
    const project = service.createProject({ ...req.body, farmerId: session.userId });
    res.status(201).json(project);
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get('/api/projects', (req, res) => {
  const { crop, risk, status, q } = req.query;
  res.json(service.listProjectsWithComputedRisk({ crop: crop as string | undefined, risk: risk as string | undefined, status: status as string | undefined, q: q as string | undefined }));
});

app.get('/api/projects/:id', (req, res) => {
  const full = service.getProjectFull(req.params.id);
  if (!full) return res.status(404).json({ error: 'Project not found' });
  res.json({ ...full, farmer: publicUser(full.farmer) });
});

app.post('/api/projects/:id/updates', requireRole('farmer'), (req, res) => {
  const session = (req as any).session as Session;
  const project = service.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.farmerId !== session.userId) return res.status(403).json({ error: 'Solo puedes reportar avances de tus propios proyectos' });
  const { message, progressDelta, imageUrl } = req.body;
  const update = service.addProjectUpdate(req.params.id, message, Number(progressDelta) || 0, imageUrl);
  res.status(201).json(update);
});

// ---------- Auth ----------
app.post('/api/auth/register-farmer', (req, res) => {
  try {
    const user = service.createFarmer(req.body);
    setSession(res, { id: uuid(), role: 'farmer', userId: user.id, name: user.name });
    res.status(201).json(publicUser(user));
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.post('/api/auth/register-investor', (req, res) => {
  try {
    const user = service.createInvestor(req.body);
    setSession(res, { id: uuid(), role: 'investor', userId: user.id, name: user.name });
    res.status(201).json(publicUser(user));
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.post('/api/auth/register-ally', (req, res) => {
  try {
    const user = service.createAlly(req.body);
    setSession(res, { id: uuid(), role: 'ally', userId: user.id, name: user.name });
    res.status(201).json(publicUser(user));
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) return res.status(400).json({ error: 'Correo, contraseña y rol son requeridos' });

  let user: any;
  if (role === 'farmer') user = service.loginFarmer(email, password);
  else if (role === 'investor') user = service.loginInvestor(email, password);
  else if (role === 'ally') user = service.loginAlly(email, password);
  else return res.status(400).json({ error: 'Rol inválido' });

  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  const session: Session = { id: uuid(), role, userId: user.id, name: user.name };
  setSession(res, session);
  res.json({ role, user: publicUser(user) });
});

// ---------- Investors ----------
app.post('/api/investors', (req, res) => {
  try { res.status(201).json(publicUser(service.createInvestor(req.body))); }
  catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get('/api/investors/:id', (req, res) => {
  const investor = service.getInvestor(req.params.id);
  if (!investor) return res.status(404).json({ error: 'Investor not found' });
  res.json(publicUser(investor));
});

app.get('/api/investors/:id/portfolio', requireRole('investor'), (req, res) => {
  const session = (req as any).session as Session;
  if (session.userId !== req.params.id) return res.status(403).json({ error: 'No puedes acceder al portafolio de otro inversionista' });
  const investor = service.getInvestor(session.userId);
  if (!investor) return res.status(404).json({ error: 'Investor not found' });
  const portfolio = service.getInvestorPortfolio(session.userId);
  res.json({ investor: publicUser(investor), ...portfolio });
});

// ---------- Investments ----------
app.post('/api/investments', requireRole('investor'), (req, res) => {
  try {
    const session = (req as any).session as Session;
    const { projectId, amount } = req.body;
    const investment = service.invest(session.userId, projectId, Number(amount));
    res.status(201).json(investment);
  } catch (error) { res.status(400).json({ error: String(error) }); }
});


app.post('/api/auth/investor/verify', requireRole('investor'), (req, res) => {
  try {
    const session = (req as any).session as Session;
    const investor = service.verifyInvestor(session.userId, req.body || {});
    if (!investor) return res.status(404).json({ error: 'Investor not found' });
    res.json({ user: publicUser(investor), verified: true, demo: true });
  } catch (e) { res.status(400).json({ error: String(e) }); }
});

app.get('/api/allies/:id/dashboard', requireRole('ally'), (req, res) => {
  const session = (req as any).session as Session;
  if (session.userId !== req.params.id) return res.status(403).json({ error: 'No puedes acceder al panel de otro aliado' });
  const dashboard = service.getAllyDashboard(session.userId);
  if (!dashboard) return res.status(404).json({ error: 'Ally not found' });
  res.json(dashboard);
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'AgerVest API v0.3' }));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AgerVest API + Web running on http://localhost:${PORT}`));
