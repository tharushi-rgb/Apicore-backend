// Queen management routes
import express from 'express';
import { db, authenticateToken, sendError } from '../shared.js';

const router = express.Router();

// @route   GET /api/queens
// @desc    Get queens, optionally filtered by hiveId
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let queens;
    if (filterHiveId) {
      queens = await db.prepare(`
        SELECT q.*, h.name as hive_name
        FROM queens q
        LEFT JOIN hives h ON q.hive_id = h.id
        WHERE q.hive_id = ?
        ORDER BY q.introduction_date DESC
      `).all(filterHiveId);
    } else {
      queens = await db.prepare(`
        SELECT q.*, h.name as hive_name
        FROM queens q
        LEFT JOIN hives h ON q.hive_id = h.id
        ORDER BY q.introduction_date DESC
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
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const queen = await db.prepare(`
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
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const hiveId = body.hiveId || body.hive_id;
    const species = body.species || body.breed || null;
    const source = body.source || 'natural';
    const introductionDate = body.introduction_date || body.introducedDate || body.introduced_date || null;
    const status = body.status || 'active';
    const markingColor = body.marking_color || body.markedColor || body.marked_color || null;
    const notes = body.notes || null;

    if (!hiveId) {
      return res.status(400).json({
        success: false,
        message: 'Hive ID is required'
      });
    }

    // Verify hive exists
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    // Set any existing active queen to superseded when adding new active queen
    if (status === 'active') {
      await db.prepare("UPDATE queens SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE hive_id = ? AND status = 'active'")
        .run(hiveId);
      // Update the hive queen_present flag
      await db.prepare('UPDATE hives SET queen_present = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hiveId);
    }

    const result = await db.prepare(`
      INSERT INTO queens (user_id, hive_id, species, source, introduction_date, status, marking_color, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, hiveId, species, source, introductionDate, status, markingColor, notes);

    const queen = await db.prepare('SELECT * FROM queens WHERE id = ?').get(result.lastInsertRowid);

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
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Queen record not found' });
    }

    const body = req.body || {};
    const species = body.species !== undefined ? body.species : (body.breed !== undefined ? body.breed : existing.species);
    const source = body.source || existing.source;
    const introductionDate = body.introduction_date || body.introducedDate || body.introduced_date || existing.introduction_date;
    const status = body.status || existing.status;
    const markingColor = body.marking_color !== undefined ? body.marking_color : (body.markedColor !== undefined ? body.markedColor : (body.marked_color !== undefined ? body.marked_color : existing.marking_color));
    const notes = body.notes !== undefined ? body.notes : existing.notes;

    // If changing to active, supersede other active queens in the same hive
    if (status === 'active' && existing.status !== 'active') {
      await db.prepare("UPDATE queens SET status = 'superseded', updated_at = CURRENT_TIMESTAMP WHERE hive_id = ? AND status = 'active' AND id != ?")
        .run(existing.hive_id, req.params.id);
      await db.prepare('UPDATE hives SET queen_present = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.hive_id);
    }

    // If changing away from active, check if any queens remain active
    if (status !== 'active' && existing.status === 'active') {
      const otherActive = await db.prepare("SELECT COUNT(*) as count FROM queens WHERE hive_id = ? AND status = 'active' AND id != ?")
        .get(existing.hive_id, req.params.id);
      if (otherActive.count === 0) {
        await db.prepare('UPDATE hives SET queen_present = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(existing.hive_id);
      }
    }

    await db.prepare(`
      UPDATE queens
      SET species = ?, source = ?, introduction_date = ?, status = ?, marking_color = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(species, source, introductionDate, status, markingColor, notes, req.params.id);

    const queen = await db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Queen updated', data: { queen } });
  } catch (error) {
    console.error('Update queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/queens/:id
// @desc    Delete queen record
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const queen = await db.prepare('SELECT * FROM queens WHERE id = ?').get(req.params.id);
    if (!queen) {
      return res.status(404).json({ success: false, message: 'Queen record not found' });
    }

    await db.prepare('DELETE FROM queens WHERE id = ?').run(req.params.id);

    // Check if hive still has an active queen
    if (queen.status === 'active') {
      const otherActive = await db.prepare("SELECT COUNT(*) as count FROM queens WHERE hive_id = ? AND status = 'active'")
        .get(queen.hive_id);
      if (otherActive.count === 0) {
        await db.prepare('UPDATE hives SET queen_present = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(queen.hive_id);
      }
    }

    res.json({ success: true, message: 'Queen record deleted' });
  } catch (error) {
    console.error('Delete queen error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
