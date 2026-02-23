// Harvests routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/harvests
// @desc    Get harvests (admin view, optional hiveId/apiaryId)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId, apiaryId } = req.query;

    const query = `
      SELECT h.*, hv.name as hive_name, a.name as apiary_name
      FROM harvests h
      LEFT JOIN hives hv ON h.hive_id = hv.id
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE 1 = 1
      ${hiveId ? 'AND h.hive_id = ?' : ''}
      ${apiaryId ? 'AND h.apiary_id = ?' : ''}
      ORDER BY h.harvest_date DESC
    `;

    const params = [];
    if (hiveId) params.push(hiveId);
    if (apiaryId) params.push(apiaryId);

    const harvests = await db.prepare(query).all(...params);
    res.json({ success: true, data: { harvests } });
  } catch (error) {
    console.error('Get harvests error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/harvests
// @desc    Create new harvest
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const hiveId = body.hiveId || body.hive_id;
    const apiaryId = body.apiaryId || body.apiary_id;
    const harvestDate = body.harvestDate || body.harvest_date;
    const harvestType = body.harvestType || body.harvest_type || 'honey';
    const quantity = body.quantity !== undefined ? body.quantity : body.honey_quantity !== undefined ? body.honey_quantity : body.total_quantity;
    const unit = body.unit || 'kg';
    const quality = body.quality || body.quality_grade;
    const notes = body.notes || null;

    if (!harvestDate || harvestType === undefined || quantity === undefined) {
      return res.status(400).json({ success: false, message: 'Date, type, and quantity are required' });
    }

    const normalizedHiveId = hiveId ? Number(hiveId) : null;
    const normalizedApiaryId = apiaryId ? Number(apiaryId) : null;

    if (normalizedHiveId) {
      const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(normalizedHiveId);
      if (!hive) return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    if (normalizedApiaryId) {
      const apiary = await db.prepare('SELECT * FROM apiaries WHERE id = ?').get(normalizedApiaryId);
      if (!apiary) return res.status(404).json({ success: false, message: 'Apiary not found' });
    }

    const result = await db.prepare(`
      INSERT INTO harvests (
        user_id, hive_id, apiary_id, harvest_date, harvest_type,
        quantity, unit, quality, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      normalizedHiveId,
      normalizedApiaryId,
      harvestDate,
      harvestType,
      quantity,
      unit || 'kg',
      quality || null,
      notes || null
    );

    const harvest = await db.prepare('SELECT * FROM harvests WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: { harvest }, id: harvest.id });
  } catch (error) {
    console.error('Create harvest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/harvests/:id
// @desc    Update harvest
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM harvests WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Harvest not found' });
    }

    const {
      harvestDate,
      harvestType,
      quantity,
      unit,
      quality,
      notes,
    } = req.body;

    await db.prepare(`
      UPDATE harvests
      SET harvest_date = ?, harvest_type = ?, quantity = ?, unit = ?, quality = ?,
          notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      harvestDate || existing.harvest_date,
      harvestType || existing.harvest_type,
      quantity !== undefined ? quantity : existing.quantity,
      unit || existing.unit,
      quality !== undefined ? quality : existing.quality,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const harvest = await db.prepare('SELECT * FROM harvests WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { harvest } });
  } catch (error) {
    console.error('Update harvest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/harvests/:id
// @desc    Delete harvest
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM harvests WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Harvest not found' });
    }

    await db.prepare('DELETE FROM harvests WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Harvest deleted successfully' });
  } catch (error) {
    console.error('Delete harvest error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
