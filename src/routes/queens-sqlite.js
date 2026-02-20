// Queen management routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/queens
// @desc    Get queens, optionally filtered by hiveId
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let queens;
    if (filterHiveId) {
      queens = db.prepare(`
        SELECT q.*, h.name as hive_name
        FROM queens q
        LEFT JOIN hives h ON q.hive_id = h.id
        WHERE q.hive_id = ?
        ORDER BY q.introduced_date DESC
      `).all(filterHiveId);
    } else {
      queens = db.prepare(`
        SELECT q.*, h.name as hive_name
        FROM queens q
        LEFT JOIN hives h ON q.hive_id = h.id
        ORDER BY q.introduced_date DESC
      `).all();
    }

    res.json({ success: true, data: { queens } });
  } catch (error) {
    console.error('Get queens error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/queens/:id
// @desc    Get single queen by ID
// @access  Private
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const queen = db.prepare(`
      SELECT q.*, h.name as hive_name
      FROM queens q
      LEFT JOIN hives h ON q.hive_id = h.id
      WHERE q.id = ?
    `).get(req.params.id);

    if (!queen) {
      return res.status(404).json({ success: false, message: 'Queen record not found' });
    }

    res.json({ success: true, data: { queen } });
  } catch (error) {
    console.error('Get queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/queens
// @desc    Add queen record to hive
// @access  Private
router.post('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    const hiveId = body.hiveId || body.hive_id;
    const breed = body.breed || null;
    const source = body.source || 'natural';
    const introducedDate = body.introducedDate || body.introduced_date || null;
    const status = body.status || 'active';
    const markedColor = body.markedColor || body.marked_color || null;
    const notes = body.notes || null;

    if (!hiveId) {
      return res.status(400).json({
        success: false,
        message: 'Hive ID is required'
      });
    }

    // Verify hive exists
    const hive = db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    // Set any existing active queen to superseded when adding new active queen
    if (status === 'active') {
      db.prepare("UPDATE queens SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE hive_id = ? AND status = 'active'")
        .run(hiveId);
      // Update the hive queen_present flag
      db.prepare('UPDATE hives SET queen_present = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hiveId);
    }

    const result = db.prepare(`
      INSERT INTO queens (hive_id, breed, source, introduced_date, status, marked_color, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(hiveId, breed, source, introducedDate, status, markedColor, notes);

    const queen = db.prepare('SELECT * FROM queens WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Queen record added successfully',
      data: { queen }
    });
  } catch (error) {
    console.error('Create queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/queens/:id
// @desc    Update queen record
// @access  Private
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Queen record not found' });
    }

    const body = req.body || {};
    const breed = body.breed !== undefined ? body.breed : existing.breed;
    const source = body.source || existing.source;
    const introducedDate = body.introducedDate || body.introduced_date || existing.introduced_date;
    const status = body.status || existing.status;
    const markedColor = body.markedColor || body.marked_color || existing.marked_color;
    const notes = body.notes !== undefined ? body.notes : existing.notes;

    // If changing to active, supersede other active queens in the same hive
    if (status === 'active' && existing.status !== 'active') {
      db.prepare("UPDATE queens SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE hive_id = ? AND status = 'active' AND id != ?")
        .run(existing.hive_id, req.params.id);
      db.prepare('UPDATE hives SET queen_present = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.hive_id);
    }

    // If changing away from active, check if any queens remain active
    if (status !== 'active' && existing.status === 'active') {
      const otherActive = db.prepare("SELECT COUNT(*) as count FROM queens WHERE hive_id = ? AND status = 'active' AND id != ?")
        .get(existing.hive_id, req.params.id);
      if (otherActive.count === 0) {
        db.prepare('UPDATE hives SET queen_present = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.hive_id);
      }
    }

    db.prepare(`
      UPDATE queens
      SET breed = ?, source = ?, introduced_date = ?, status = ?, marked_color = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(breed, source, introducedDate, status, markedColor, notes, req.params.id);

    const queen = db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Queen updated', data: { queen } });
  } catch (error) {
    console.error('Update queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/queens/:id
// @desc    Delete queen record
// @access  Private
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const queen = db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    if (!queen) {
      return res.status(404).json({ success: false, message: 'Queen record not found' });
    }

    db.prepare('DELETE FROM queens WHERE id = ?').run(req.params.id);

    // Check if hive still has an active queen
    if (queen.status === 'active') {
      const otherActive = db.prepare("SELECT COUNT(*) as count FROM queens WHERE hive_id = ? AND status = 'active'")
        .get(queen.hive_id);
      if (otherActive.count === 0) {
        db.prepare('UPDATE hives SET queen_present = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(queen.hive_id);
      }
    }

    res.json({ success: true, message: 'Queen record deleted' });
  } catch (error) {
    console.error('Delete queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
