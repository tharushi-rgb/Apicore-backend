/**
 * index.js — ApiCore Backend entry point
 *
 * All configuration comes from config/app.cjs (via shared.js).
 * Route files are registered in a single, maintainable table.
 */

import express from 'express';
import cors from 'cors';
import { config } from './shared.js';

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes          from './routes/auth-sqlite.js';
import apiariesRoutes      from './routes/apiaries-sqlite.js';
import hivesRoutes         from './routes/hives-sqlite.js';
import inspectionsRoutes   from './routes/inspections-sqlite.js';
import harvestsRoutes      from './routes/harvests-sqlite.js';
import expensesRoutes      from './routes/expenses-sqlite.js';
import incomeRoutes        from './routes/income-sqlite.js';
import dashboardRoutes     from './routes/dashboard-sqlite.js';
import profileRoutes       from './routes/profile-sqlite.js';
import planningRoutes      from './routes/planning-sqlite.js';
import feedingsRoutes      from './routes/feedings-sqlite.js';
import componentsRoutes    from './routes/components-sqlite.js';
import queensRoutes        from './routes/queens-sqlite.js';
import treatmentsRoutes    from './routes/treatments-sqlite.js';
import helpersRoutes       from './routes/helpers-sqlite.js';
import clientsRoutes       from './routes/clients-sqlite.js';
import notificationsRoutes from './routes/notifications-sqlite.js';
import transfersRoutes     from './routes/transfers-sqlite.js';

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Route table — add / remove routes in ONE place ──────────────────────────
const routes = [
  ['/api/auth',          authRoutes],
  ['/api/apiaries',      apiariesRoutes],
  ['/api/hives',         hivesRoutes],
  ['/api/inspections',   inspectionsRoutes],
  ['/api/harvests',      harvestsRoutes],
  ['/api/expenses',      expensesRoutes],
  ['/api/income',        incomeRoutes],
  ['/api/dashboard',     dashboardRoutes],
  ['/api/profile',       profileRoutes],
  ['/api/planning',      planningRoutes],
  ['/api/feedings',      feedingsRoutes],
  ['/api/components',    componentsRoutes],
  ['/api/queens',        queensRoutes],
  ['/api/treatments',    treatmentsRoutes],
  ['/api/helpers',       helpersRoutes],
  ['/api/clients',       clientsRoutes],
  ['/api/notifications', notificationsRoutes],
  ['/api/transfers',     transfersRoutes],
];

routes.forEach(([path, handler]) => app.use(path, handler));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'ApiCore Backend is running',
    database: config.DATABASE_URL ? 'PostgreSQL' : 'SQLite',
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Server Error',
    error: config.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(config.PORT, () => {
  const routePaths = routes.map(([p]) => p).join(', ');
  console.log(`✓ ApiCore Backend running on port ${config.PORT}`);
  console.log(`✓ Database: ${config.DATABASE_URL ? 'PostgreSQL' : 'SQLite'}`);
  console.log(`✓ Routes: ${routePaths}`);
});

export default app;
