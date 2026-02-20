import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import SQLite-based routes
import authRoutes from './routes/auth-sqlite.js';
import apiariesRoutes from './routes/apiaries-sqlite.js';
import hivesRoutes from './routes/hives-sqlite.js';
import inspectionsRoutes from './routes/inspections-sqlite.js';
import harvestsRoutes from './routes/harvests-sqlite.js';
import expensesRoutes from './routes/expenses-sqlite.js';
import incomeRoutes from './routes/income-sqlite.js';
import dashboardRoutes from './routes/dashboard-sqlite.js';
import profileRoutes from './routes/profile-sqlite.js';
import planningRoutes from './routes/planning-sqlite.js';
import feedingsRoutes from './routes/feedings-sqlite.js';
import componentsRoutes from './routes/components-sqlite.js';
import queensRoutes from './routes/queens-sqlite.js';
import treatmentsRoutes from './routes/treatments-sqlite.js';
import helpersRoutes from './routes/helpers-sqlite.js';
import clientsRoutes from './routes/clients-sqlite.js';
import notificationsRoutes from './routes/notifications-sqlite.js';
import transfersRoutes from './routes/transfers-sqlite.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/apiaries', apiariesRoutes);
app.use('/api/hives', hivesRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/harvests', harvestsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/income', incomeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/planning', planningRoutes);
app.use('/api/feedings', feedingsRoutes);
app.use('/api/components', componentsRoutes);
app.use('/api/queens', queensRoutes);
app.use('/api/treatments', treatmentsRoutes);
app.use('/api/helpers', helpersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/transfers', transfersRoutes);

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'ApiCore Backend is running with SQLite database' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`✓ ApiCore Backend running on port ${PORT}`);
  console.log(`✓ Using SQLite database`);
  console.log(`✓ Available routes: /api/auth, /api/apiaries, /api/hives, /api/inspections, /api/harvests, /api/expenses, /api/income, /api/dashboard, /api/profile`);
});

export default app;
