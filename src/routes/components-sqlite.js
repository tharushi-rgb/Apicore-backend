// Hive Components routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/components
// @desc    Get hive components, optionally filtered by hiveId
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let components;
    if (filterHiveId) {
      components = db.prepare(`
        SELECT c.*, h.name as hive_name
        FROM hive_components c
        LEFT JOIN hives h ON c.hive_id = h.id
        WHERE c.hive_id = ?
        ORDER BY c.created_at DESC
      `).all(filterHiveId);
    } else {
      components = db.prepare(`
        SELECT c.*, h.name as hive_name
        FROM hive_components c
        LEFT JOIN hives h ON c.hive_id = h.id
        ORDER BY c.created_at DESC
      `).all();
    }

    res.json({ success: true, data: { components } });
  } catch (error) {
    console.error('Get components error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/components/:id
// @desc    Get single component by ID
// @access  Private
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const component = db.prepare(`
      SELECT c.*, h.name as hive_name
      FROM hive_components c
      LEFT JOIN hives h ON c.hive_id = h.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!component) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }

    res.json({ success: true, data: { component } });
  } catch (error) {
    console.error('Get component error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/components
// @desc    Add component to hive
// @access  Private
router.post('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    const hiveId = body.hiveId || body.hive_id;
    const componentType = body.componentType || body.component_type;
    const quantity = body.quantity || 1;
    const condition = body.condition || 'good';
    const installedDate = body.installedDate || body.installed_date || null;
    const notes = body.notes || null;

    if (!hiveId || !componentType) {
      return res.status(400).json({
        success: false,
        message: 'Hive ID and component type are required'
      });
    }

    // Verify hive exists
    const hive = db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const result = db.prepare(`
      INSERT INTO hive_components (hive_id, component_type, quantity, condition, installed_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(hiveId, componentType, quantity, condition, installedDate, notes);

    const component = db.prepare('SELECT * FROM hive_components WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Component added successfully',
      data: { component }
    });
  } catch (error) {
    console.error('Create component error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/components/:id
// @desc    Update component
// @access  Private
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM hive_components WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }

    const body = req.body || {};
    const componentType = body.componentType || body.component_type || existing.component_type;
    const quantity = body.quantity !== undefined ? body.quantity : existing.quantity;
    const condition = body.condition || existing.condition;
    const installedDate = body.installedDate || body.installed_date || existing.installed_date;
    const notes = body.notes !== undefined ? body.notes : existing.notes;

    db.prepare(`
      UPDATE hive_components
      SET component_type = ?, quantity = ?, condition = ?, installed_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(componentType, quantity, condition, installedDate, notes, req.params.id);

    const component = db.prepare('SELECT * FROM hive_components WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Component updated', data: { component } });
  } catch (error) {
    console.error('Update component error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/components/:id
// @desc    Remove component from hive
// @access  Private
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const component = db.prepare('SELECT * FROM hive_components WHERE id = ?').get(req.params.id);
    if (!component) {
      return res.status(404).json({ success: false, message: 'Component not found' });
    }

    db.prepare('DELETE FROM hive_components WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Component removed successfully' });
  } catch (error) {
    console.error('Delete component error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
