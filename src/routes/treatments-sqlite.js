// Treatments routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/treatments
// @desc    Get treatments, optionally filtered by hiveId
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let treatments;
    if (filterHiveId) {
      treatments = await db.prepare(`
        SELECT t.*, h.name as hive_name
        FROM treatments t
        LEFT JOIN hives h ON t.hive_id = h.id
        WHERE t.hive_id = ?
        ORDER BY t.treatment_date DESC
      `).all(filterHiveId);
    } else {
      treatments = await db.prepare(`
        SELECT t.*, h.name as hive_name
        FROM treatments t
        LEFT JOIN hives h ON t.hive_id = h.id
        ORDER BY t.treatment_date DESC
      `).all();
    }

    res.json({ success: true, data: { treatments } });
  } catch (error) {
    console.error('Get treatments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/treatments/:id
// @desc    Get single treatment by ID
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const treatment = await db.prepare(`
      SELECT t.*, h.name as hive_name
      FROM treatments t
      LEFT JOIN hives h ON t.hive_id = h.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    res.json({ success: true, data: { treatment } });
  } catch (error) {
    console.error('Get treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/treatments
// @desc    Record treatment for a hive
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const hiveId = body.hiveId || body.hive_id;
    const treatmentDate = body.treatmentDate || body.treatment_date;
    const treatmentType = body.treatmentType || body.treatment_type;
    const productName = body.productName || body.product_name || null;
    const dosage = body.dosage || null;
    const applicationMethod = body.applicationMethod || body.application_method || null;
    const durationDays = body.durationDays || body.duration_days || null;
    const endDate = body.endDate || body.end_date || null;
    const outcome = body.outcome || null;
    const notes = body.notes || null;

    if (!hiveId || !treatmentDate || !treatmentType) {
      return res.status(400).json({
        success: false,
        message: 'Hive ID, treatment date, and treatment type are required'
      });
    }

    // Verify hive exists
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const result = await db.prepare(`
      INSERT INTO treatments (user_id, hive_id, treatment_date, treatment_type, product_name, dosage, application_method, duration_days, end_date, outcome, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, hiveId, treatmentDate, treatmentType, productName, dosage, applicationMethod, durationDays, endDate, outcome, notes);

    const treatment = await db.prepare('SELECT * FROM treatments WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Treatment recorded successfully',
      data: { treatment }
    });
  } catch (error) {
    console.error('Create treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/treatments/:id
// @desc    Update treatment record
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM treatments WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    const body = req.body || {};
    const treatmentDate = body.treatmentDate || body.treatment_date || existing.treatment_date;
    const treatmentType = body.treatmentType || body.treatment_type || existing.treatment_type;
    const productName = body.productName !== undefined ? body.productName : (body.product_name !== undefined ? body.product_name : existing.product_name);
    const dosage = body.dosage !== undefined ? body.dosage : existing.dosage;
    const applicationMethod = body.applicationMethod !== undefined ? body.applicationMethod : (body.application_method !== undefined ? body.application_method : existing.application_method);
    const durationDays = body.durationDays !== undefined ? body.durationDays : (body.duration_days !== undefined ? body.duration_days : existing.duration_days);
    const endDate = body.endDate !== undefined ? body.endDate : (body.end_date !== undefined ? body.end_date : existing.end_date);
    const outcome = body.outcome !== undefined ? body.outcome : existing.outcome;
    const notes = body.notes !== undefined ? body.notes : existing.notes;

    await db.prepare(`
      UPDATE treatments
      SET treatment_date = ?, treatment_type = ?, product_name = ?, dosage = ?, application_method = ?, duration_days = ?, end_date = ?, outcome = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(treatmentDate, treatmentType, productName, dosage, applicationMethod, durationDays, endDate, outcome, notes, req.params.id);

    const treatment = await db.prepare('SELECT * FROM treatments WHERE id = ?').get(req.params.id);
    res.json({ success: true, message: 'Treatment updated', data: { treatment } });
  } catch (error) {
    console.error('Update treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/treatments/:id
// @desc    Delete treatment record
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const treatment = await db.prepare('SELECT * FROM treatments WHERE id = ?').get(req.params.id);
    if (!treatment) {
      return res.status(404).json({ success: false, message: 'Treatment not found' });
    }

    await db.prepare('DELETE FROM treatments WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Treatment deleted' });
  } catch (error) {
    console.error('Delete treatment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
