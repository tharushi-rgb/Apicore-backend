// Income routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/income
// @desc    Get income (admin view)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const income = await db.prepare(`
      SELECT i.*, h.harvest_type as harvest_type
      FROM income i
      LEFT JOIN harvests h ON i.harvest_id = h.id
      ORDER BY i.income_date DESC
    `).all();

    res.json({ success: true, data: { income } });
  } catch (error) {
    console.error('Get income error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/income
// @desc    Create income
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const incomeDate = body.incomeDate || body.income_date || body.date;
    const incomeType = body.incomeType || body.income_type || body.category;
    const amount = body.amount !== undefined ? body.amount : body.total_amount;
    const harvestId = body.harvestId || body.harvest_id;
    const buyerName = body.buyerName || body.buyer_name;
    const description = body.description || body.item || body.payment_method || null;
    const notes = body.notes || null;

    if (!incomeDate || !incomeType || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Date, type, and amount are required' });
    }

    const normalizedHarvestId = harvestId ? Number(harvestId) : null;
    if (normalizedHarvestId) {
      const harvest = await db.prepare('SELECT * FROM harvests WHERE id = ?').get(normalizedHarvestId);
      if (!harvest) return res.status(404).json({ success: false, message: 'Harvest not found' });
    }

    const result = await db.prepare(`
      INSERT INTO income (
        user_id, harvest_id, income_date, income_type,
        amount, buyer_name, description, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      normalizedHarvestId,
      incomeDate,
      incomeType,
      amount,
      buyerName || null,
      description || null,
      notes || null
    );

    const income = await db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: { income }, id: income.id });
  } catch (error) {
    console.error('Create income error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/income/:id
// @desc    Update income
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM income WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Income not found' });
    }

    const {
      incomeDate,
      incomeType,
      amount,
      buyerName,
      description,
      notes,
    } = req.body;

    await db.prepare(`
      UPDATE income
      SET income_date = ?, income_type = ?, amount = ?, buyer_name = ?,
          description = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      incomeDate || existing.income_date,
      incomeType || existing.income_type,
      amount !== undefined ? amount : existing.amount,
      buyerName !== undefined ? buyerName : existing.buyer_name,
      description !== undefined ? description : existing.description,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const income = await db.prepare('SELECT * FROM income WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { income } });
  } catch (error) {
    console.error('Update income error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/income/:id
// @desc    Delete income
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM income WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Income not found' });
    }

    await db.prepare('DELETE FROM income WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Income deleted successfully' });
  } catch (error) {
    console.error('Delete income error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
