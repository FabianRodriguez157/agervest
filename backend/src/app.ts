import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';

import { config } from './lib/config';
import { errorHandler } from './middleware/errorHandler';
import { authOptional, authRequired } from './middleware/auth';

import authRoutes from './routes/auth.routes';
import farmersRoutes from './routes/farmers.routes';
import projectsRoutes from './routes/projects.routes';
import investorsRoutes from './routes/investors.routes';
import investmentsRoutes from './routes/investments.routes';
import alliesRoutes from './routes/allies.routes';
import statsRoutes from './routes/stats.routes';
import walletRoutes from './routes/wallet.routes';
import adminRoutes from './routes/admin.routes';

export function buildApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  if (config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins, credentials: true }));
  }
  app.use(authOptional);

  // Health
  app.get('/health', (_req, res) => res.json({
    status: 'ok', service: 'AgerVest API', version: '1.0.0',
  }));

  // API
  app.use('/api/auth', authRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/farmers', farmersRoutes);
  app.use('/api/projects', projectsRoutes);
  app.use('/api/investors', investorsRoutes);
  app.use('/api/investments', investmentsRoutes);
  app.use('/api/allies', alliesRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/admin', adminRoutes);

  // Serve legacy static frontend if present (public/ en la raíz del proyecto)
  const publicDir = path.join(__dirname, '..', '..', 'public');
  if (fs.existsSync(publicDir)) {
    const protectedPages: Record<string, 'farmer'|'investor'|'ally'|'admin'> = {
      '/farmer-dashboard.html':   'farmer',
      '/investor-dashboard.html': 'investor',
      '/ally-dashboard.html':     'ally',
      '/admin-dashboard.html':    'admin',
    };
    app.use((req, res, next) => {
      const needs = protectedPages[req.path];
      if (!needs) return next();
      if (!req.auth) return res.redirect('/login.html');
      if (req.auth.role !== needs) return res.redirect('/index.html');
      next();
    });
    app.use(express.static(publicDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
