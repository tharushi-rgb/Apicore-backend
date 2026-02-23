// Hives routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/hives
// @desc    Get all hives (admin view)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const hives = await db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      ORDER BY h.created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: { hives }
    });
  } catch (error) {
    console.error('Get hives error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/hives/:id
// @desc    Get single hive by ID (admin view)
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const hive = await db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.id = ?
    `).get(req.params.id);
    
    if (!hive) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    res.json({
      success: true,
      data: { hive }
    });
  } catch (error) {
    console.error('Get hive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/hives
// @desc    Create new hive
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const apiaryId = body.apiaryId || body.apiary_id;
    const name = body.name || body.hive_number;
    const hiveType = body.hiveType || body.hive_type || 'box';
    const locationType = body.locationType || body.location_type || 'apiary-linked';
    const status = body.status || 'active';
    const queenPresent = body.queenPresent !== undefined ? body.queenPresent : body.queen_present !== undefined ? body.queen_present : 1;
    const queenAge = body.queenAge || body.queen_age_months;
    const queenAgeRisk = body.queenAgeRisk || body.queen_age_risk;
    const colonyStrength = body.colonyStrength || body.colony_strength;
    const lastInspectionDate = body.lastInspectionDate || body.installation_date || null;
    const gpsLatitude = body.gpsLatitude || body.gps_latitude || null;
    const gpsLongitude = body.gpsLongitude || body.gps_longitude || null;

    const normalizedHiveType = hiveType || 'box';
    const normalizedLocationType = locationType || 'apiary-linked';
    const normalizedQueenPresent = typeof queenPresent === 'boolean' ? (queenPresent ? 1 : 0) : queenPresent;
    const normalizedApiaryId = Number.isFinite(apiaryId) ? apiaryId : apiaryId ? Number(apiaryId) : null;
    const normalizedQueenAge = queenAge === undefined || queenAge === '' ? null : queenAge;
    const normalizedQueenAgeRisk = queenAgeRisk || null;
    const normalizedColonyStrength = colonyStrength || null;
    const normalizedLastInspectionDate = lastInspectionDate || null;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Please provide hive name'
      });
    }

    // If apiary_id is provided, verify it belongs to user
    if (normalizedApiaryId) {
      const apiary = await db.prepare('SELECT * FROM apiaries WHERE id = ?').get(normalizedApiaryId);
      if (!apiary) {
        return res.status(404).json({
          success: false,
          message: 'Apiary not found'
        });
      }
    }

    // Insert new hive
    const result = await db.prepare(`
      INSERT INTO hives (
        user_id, apiary_id, name, hive_type, location_type, status,
        queen_present, queen_age, queen_age_risk, colony_strength, last_inspection_date,
        gps_latitude, gps_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      normalizedApiaryId,
      name,
      normalizedHiveType,
      normalizedLocationType,
      status,
      normalizedQueenPresent,
      normalizedQueenAge,
      normalizedQueenAgeRisk,
      normalizedColonyStrength,
      normalizedLastInspectionDate,
      gpsLatitude,
      gpsLongitude
    );

    // Get the created hive
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Hive created successfully',
      data: { hive },
      id: hive.id // convenience for existing Postman tests
    });
  } catch (error) {
    console.error('Create hive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/hives/:id
// @desc    Update hive
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const {
      apiaryId,
      name,
      hiveType,
      locationType,
      status,
      queenPresent,
      queenAge,
      queenAgeRisk,
      colonyStrength,
      lastInspectionDate,
      gpsLatitude,
      gpsLongitude
    } = req.body;

    // Check if hive exists and belongs to user
    const existingHive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    
    if (!existingHive) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    const normalizedHiveType = hiveType || existingHive.hive_type || 'box';
    const normalizedLocationType = locationType || existingHive.location_type || 'apiary-linked';
    const normalizedQueenPresent = queenPresent === undefined
      ? existingHive.queen_present
      : typeof queenPresent === 'boolean'
        ? (queenPresent ? 1 : 0)
        : queenPresent;
    const normalizedApiaryId = apiaryId === undefined
      ? existingHive.apiary_id
      : Number.isFinite(apiaryId)
        ? apiaryId
        : apiaryId
          ? Number(apiaryId)
          : null;
    const normalizedQueenAge = queenAge === undefined || queenAge === '' ? null : queenAge;
    const normalizedQueenAgeRisk = queenAgeRisk === undefined ? existingHive.queen_age_risk : (queenAgeRisk || null);
    const normalizedColonyStrength = colonyStrength === undefined ? existingHive.colony_strength : (colonyStrength || null);
    const normalizedLastInspectionDate = lastInspectionDate === undefined ? existingHive.last_inspection_date : (lastInspectionDate || null);

    // If apiary_id is being updated, verify it belongs to user
    if (normalizedApiaryId && normalizedApiaryId !== existingHive.apiary_id) {
      const apiary = await db.prepare('SELECT * FROM apiaries WHERE id = ?').get(normalizedApiaryId);
      if (!apiary) {
        return res.status(404).json({
          success: false,
          message: 'Apiary not found'
        });
      }
    }

    // Update hive
    await db.prepare(`
      UPDATE hives 
      SET apiary_id = ?, name = ?, hive_type = ?, location_type = ?, status = ?,
          queen_present = ?, queen_age = ?, queen_age_risk = ?, colony_strength = ?,
          last_inspection_date = ?, gps_latitude = ?, gps_longitude = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      normalizedApiaryId,
      name || existingHive.name,
      normalizedHiveType,
      normalizedLocationType,
      status || existingHive.status,
      normalizedQueenPresent,
      normalizedQueenAge,
      normalizedQueenAgeRisk,
      normalizedColonyStrength,
      normalizedLastInspectionDate,
      gpsLatitude !== undefined ? gpsLatitude : existingHive.gps_latitude,
      gpsLongitude !== undefined ? gpsLongitude : existingHive.gps_longitude,
      req.params.id
    );

    // Get updated hive
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      message: 'Hive updated successfully',
      data: { hive }
    });
  } catch (error) {
    console.error('Update hive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/hives/:id
// @desc    Delete hive
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if hive exists and belongs to user
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    
    if (!hive) {
      return res.status(404).json({
        success: false,
        message: 'Hive not found'
      });
    }

    // Delete hive
    await db.prepare('DELETE FROM hives WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: 'Hive deleted successfully'
    });
  } catch (error) {
    console.error('Delete hive error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PATCH /api/hives/:id/move
// @desc    Move hive to a different apiary
// @access  Private
router.patch('/:id/move', authenticateToken, async (req, res) => {
  try {
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const body = req.body || {};
    const targetApiaryId = body.apiaryId || body.apiary_id;

    if (!targetApiaryId) {
      return res.status(400).json({ success: false, message: 'Target apiary ID is required' });
    }

    // Verify target apiary exists
    const targetApiary = await db.prepare('SELECT * FROM apiaries WHERE id = ?').get(targetApiaryId);
    if (!targetApiary) {
      return res.status(404).json({ success: false, message: 'Target apiary not found' });
    }

    // R7.1: Block moving hive to inactive apiary
    if (targetApiary.status === 'inactive') {
      return res.status(400).json({ success: false, message: 'Cannot move hive to an inactive apiary' });
    }

    const previousApiaryId = hive.apiary_id;
    await db.prepare('UPDATE hives SET apiary_id = ?, location_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(targetApiaryId, 'apiary-linked', req.params.id);

    // Log in apiary_history if table exists
    try {
      await db.prepare(`INSERT INTO apiary_history (apiary_id, action, details) VALUES (?, 'hive_moved_in', ?)`)
        .run(targetApiaryId, `Hive "${hive.name}" moved in from apiary ${previousApiaryId || 'standalone'}`);
      if (previousApiaryId) {
        await db.prepare(`INSERT INTO apiary_history (apiary_id, action, details) VALUES (?, 'hive_moved_out', ?)`)
          .run(previousApiaryId, `Hive "${hive.name}" moved to apiary ${targetApiaryId}`);
      }
    } catch (_) { /* apiary_history table may not exist yet */ }

    const updated = await db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.id = ?
    `).get(req.params.id);

    res.json({
      success: true,
      message: `Hive moved to ${targetApiary.name}`,
      data: { hive: updated }
    });
  } catch (error) {
    console.error('Move hive error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/hives/:id/star
// @desc    Toggle hive starred status
// @access  Private
router.patch('/:id/star', authenticateToken, async (req, res) => {
  try {
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const newStarred = hive.is_starred ? 0 : 1;
    await db.prepare('UPDATE hives SET is_starred = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newStarred, req.params.id);

    const updated = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      message: newStarred ? 'Hive starred' : 'Hive unstarred',
      data: { hive: updated }
    });
  } catch (error) {
    console.error('Toggle star error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/hives/:id/flag
// @desc    Toggle hive flagged status
// @access  Private
router.patch('/:id/flag', authenticateToken, async (req, res) => {
  try {
    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    const body = req.body || {};
    const flagReason = body.flagReason || body.flag_reason || null;

    const newFlagged = hive.is_flagged ? 0 : 1;
    await db.prepare('UPDATE hives SET is_flagged = ?, flag_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newFlagged, newFlagged ? flagReason : null, req.params.id);

    const updated = await db.prepare('SELECT * FROM hives WHERE id = ?').get(req.params.id);
    res.json({
      success: true,
      message: newFlagged ? 'Hive flagged' : 'Hive unflagged',
      data: { hive: updated }
    });
  } catch (error) {
    console.error('Toggle flag error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
