// Dashboard routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/dashboard
// @desc    Get dashboard data (admin view)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get user info
    const user = await db.prepare('SELECT id, name, email, phone, district, role, years_experience FROM users WHERE id = ?').get(req.userId);
    
    // Get statistics
    const totalApiariesRow = await db.prepare('SELECT COUNT(*) as count FROM apiaries').get();
    const totalApiaries = totalApiariesRow ? totalApiariesRow.count : 0;
    const activeApiariesRow = await db.prepare('SELECT COUNT(*) as count FROM apiaries WHERE status = ?').get('active');
    const activeApiaries = activeApiariesRow ? activeApiariesRow.count : 0;
    
    const totalHivesRow = await db.prepare('SELECT COUNT(*) as count FROM hives').get();
    const totalHives = totalHivesRow ? totalHivesRow.count : 0;
    const activeHivesRow = await db.prepare('SELECT COUNT(*) as count FROM hives WHERE status = ?').get('active');
    const activeHives = activeHivesRow ? activeHivesRow.count : 0;
    
    const totalHarvestsRow = await db.prepare('SELECT COUNT(*) as count FROM harvests').get();
    const totalHarvests = totalHarvestsRow ? totalHarvestsRow.count : 0;
    const totalHoneyRow = await db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM harvests').get();
    const totalHoneyKg = totalHoneyRow ? Number(totalHoneyRow.total) : 0;
    
    // Get recent alerts
    const alerts = await db.prepare(`
      SELECT id, alert_type as type, message, is_read, created_at
      FROM alerts
      ORDER BY created_at DESC
      LIMIT 10
    `).all();
    
    // Get apiaries with hive counts
    const apiaries = await db.prepare(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id) as hive_count,
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id AND status = 'active') as active_hive_count
      FROM apiaries a
      ORDER BY a.created_at DESC
    `).all();
    
    // Get hives with apiary info
    const hives = await db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      ORDER BY h.created_at DESC
    `).all();

    res.json({
      success: true,
      data: {
        user,
        stats: {
          totalApiaries,
          activeApiaries,
          totalHives,
          activeHives,
          totalHarvests,
          totalHoneyKg: parseFloat(totalHoneyKg.toFixed(2))
        },
        alerts,
        apiaries,
        hives
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/dashboard/analytics
// @desc    Get best performing hives, best forage locations, income/expense summary (UC18)
// @access  Private
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    // Best performing hives — ranked by total harvest quantity
    const bestHives = await db.prepare(`
      SELECT h.id, h.name, h.hive_type, a.name AS apiary_name, a.district,
             COUNT(har.id) AS harvest_count,
             COALESCE(SUM(har.quantity), 0) AS total_harvest_kg,
             h.colony_strength, h.status
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      LEFT JOIN harvests har ON har.hive_id = h.id
      GROUP BY h.id
      ORDER BY total_harvest_kg DESC
      LIMIT 10
    `).all();

    // Best forage locations — apiaries ranked by average harvest per hive
    const bestLocations = await db.prepare(`
      SELECT a.id, a.name, a.district, a.forage_primary,
             COUNT(DISTINCT h.id) AS hive_count,
             COUNT(har.id) AS total_harvests,
             COALESCE(SUM(har.quantity), 0) AS total_kg,
             CASE WHEN COUNT(DISTINCT h.id) > 0
               THEN ROUND(COALESCE(SUM(har.quantity), 0) * 1.0 / COUNT(DISTINCT h.id), 2)
               ELSE 0 END AS avg_kg_per_hive
      FROM apiaries a
      LEFT JOIN hives h ON h.apiary_id = a.id
      LEFT JOIN harvests har ON har.hive_id = h.id
      GROUP BY a.id
      HAVING hive_count > 0
      ORDER BY avg_kg_per_hive DESC
      LIMIT 10
    `).all();

    // Monthly income vs expense (last 6 months)
    const incomeByMonth = await db.prepare(`
      SELECT strftime('%Y-%m', income_date) AS month,
             COALESCE(SUM(amount), 0) AS total
      FROM income
      WHERE income_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month
    `).all();

    const expenseByMonth = await db.prepare(`
      SELECT strftime('%Y-%m', expense_date) AS month,
             COALESCE(SUM(amount), 0) AS total
      FROM expenses
      WHERE expense_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month
    `).all();

    // Queenless hives
    const queenlessHives = await db.prepare(`
      SELECT h.id, h.name, a.name AS apiary_name
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.queen_present = 0 AND h.status = 'active'
      ORDER BY h.name
    `).all();

    // Services summary
    const servicesRow = await db.prepare(`
      SELECT COUNT(*) AS total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
             COALESCE(SUM(CASE WHEN status = 'completed' THEN payment_amount ELSE 0 END), 0) AS total_revenue
      FROM client_services
    `).get();

    res.json({
      success: true,
      data: {
        bestHives: bestHives || [],
        bestLocations: bestLocations || [],
        incomeByMonth: incomeByMonth || [],
        expenseByMonth: expenseByMonth || [],
        queenlessHives: queenlessHives || [],
        services: servicesRow || { total: 0, completed: 0, total_revenue: 0 }
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;
