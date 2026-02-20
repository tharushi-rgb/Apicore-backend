// Feedings routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/feedings
// @desc    Get feedings, optionally filtered by hiveId
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let feedings;
    if (filterHiveId) {
      feedings = db.prepare(`
        SELECT f.*, h.name as hive_name
        FROM feedings f
        LEFT JOIN hives h ON f.hive_id = h.id
        WHERE f.hive_id = ?
        ORDER BY f.feeding_date DESC
      `).all(filterHiveId);
    } else {
      feedings = db.prepare(`
        SELECT f.*, h.name as hive_name
        FROM feedings f
        LEFT JOIN hives h ON f.hive_id = h.id
        ORDER BY f.feeding_date DESC
      `).all();
    }

    res.json({
      success: true,
      data: { feedings }
    });
  } catch (error) {
    console.error('Get feedings error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/feedings/:id
// @desc    Get single feeding by ID
// @access  Private
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const feeding = db.prepare(`
      SELECT f.*, h.name as hive_name
      FROM feedings f
      LEFT JOIN hives h ON f.hive_id = h.id
      WHERE f.id = ?
    `).get(req.params.id);

    if (!feeding) {
      return res.status(404).json({ success: false, message: 'Feeding record not found' });
    }

    res.json({ success: true, data: { feeding } });
  } catch (error) {
    console.error('Get feeding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/feedings
// @desc    Create feeding record
// @access  Private
router.post('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    const hiveId = body.hiveId || body.hive_id;
    const feedingDate = body.feedingDate || body.feeding_date;
    const feedType = body.feedType || body.feed_type;
    const quantity = body.quantity;
    const unit = body.unit || 'ml';
    const notes = body.notes || null;

    if (!hiveId || !feedingDate || !feedType) {
      return res.status(400).json({
        success: false,
        message: 'Hive ID, feeding date, and feed type are required'
      });
    }

    // Verify hive exists
    const hive = db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const result = db.prepare(`
      INSERT INTO feedings (hive_id, feeding_date, feed_type, quantity, unit, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hiveId, feedingDate, feedType, quantity || null, unit, notes);

    const feeding = db.prepare('SELECT * FROM feedings WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Feeding recorded successfully',
      data: { feeding }
    });
  } catch (error) {
    console.error('Create feeding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/feedings/:id
// @desc    Update feeding record
// @access  Private
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM feedings WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Feeding record not found' });
    }

    const body = req.body || {};
    const feedingDate = body.feedingDate || body.feeding_date || existing.feeding_date;
    const feedType = body.feedType || body.feed_type || existing.feed_type;
    const quantity = body.quantity !== undefined ? body.quantity : existing.quantity;
    const unit = body.unit || existing.unit;
    const notes = body.notes !== undefined ? body.notes : existing.notes;

    db.prepare(`
      UPDATE feedings
      SET feeding_date = ?, feed_type = ?, quantity = ?, unit = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(feedingDate, feedType, quantity, unit, notes, req.params.id);

    const feeding = db.prepare('SELECT * FROM feedings WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Feeding updated successfully', data: { feeding } });
  } catch (error) {
    console.error('Update feeding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/feedings/:id
// @desc    Delete feeding record
// @access  Private
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const feeding = db.prepare('SELECT * FROM feedings WHERE id = ?').get(req.params.id);
    if (!feeding) {
      return res.status(404).json({ success: false, message: 'Feeding record not found' });
    }

    db.prepare('DELETE FROM feedings WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Feeding deleted successfully' });
  } catch (error) {
    console.error('Delete feeding error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
