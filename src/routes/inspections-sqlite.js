// Inspections routes
import express from 'express';
import { db, authenticateToken, sendError } from '../shared.js';

const router = express.Router();

// @route   GET /api/inspections
// @desc    Get inspections (admin view, optional hiveId)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId } = req.query;

    const baseQuery = `
      SELECT i.*, h.name as hive_name, a.name as apiary_name
      FROM inspections i
      LEFT JOIN hives h ON i.hive_id = h.id
      LEFT JOIN apiaries a ON i.apiary_id = a.id
      WHERE 1 = 1
      ${hiveId ? 'AND i.hive_id = ?' : ''}
      ORDER BY i.inspection_date DESC
    `;

    const inspections = hiveId
      ? await db.prepare(baseQuery).all(hiveId)
      : await db.prepare(baseQuery).all();

    res.json({ success: true, data: { inspections } });
  } catch (error) {
    console.error('Get inspections error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/inspections
// @desc    Create new inspection
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const hiveId = body.hiveId || body.hive_id;
    const apiaryId = body.apiaryId || body.apiary_id;
    const inspectionDate = body.inspectionDate || body.inspection_date;
    const queenPresent = body.queenPresent !== undefined ? body.queenPresent : body.queen_present !== undefined ? body.queen_present : 1;
    const colonyStrength = body.colonyStrength || body.colony_strength;
    const pestDetected = body.pestDetected !== undefined ? body.pestDetected : body.pest_detected !== undefined ? body.pest_detected : 0;
    const notes = body.notes || null;

    if (!hiveId || !inspectionDate) {
      return res.status(400).json({ success: false, message: 'Hive and inspection date are required' });
    }

    const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(hiveId);
    if (!hive) {
      return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    // GPS geo-fencing check (R9.2/R9.3) — block if >50m from hive location
    const userLat = body.userLatitude || body.user_latitude;
    const userLng = body.userLongitude || body.user_longitude;
    if (userLat && userLng && hive.gps_latitude && hive.gps_longitude) {
      const toRad = (deg) => deg * (Math.PI / 180);
      const R = 6371000; // Earth radius in meters
      const dLat = toRad(hive.gps_latitude - userLat);
      const dLng = toRad(hive.gps_longitude - userLng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userLat)) * Math.cos(toRad(hive.gps_latitude)) * Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      if (distance > 50) {
        return res.status(400).json({
          success: false,
          message: `GPS verification failed. You are ${Math.round(distance)}m from the hive. Must be within 50m to record an inspection.`,
          distance: Math.round(distance)
        });
      }
    }

    const normalizedApiaryId = apiaryId ? Number(apiaryId) : hive.apiary_id || null;
    const normalizedQueenPresent = typeof queenPresent === 'boolean' ? (queenPresent ? 1 : 0) : queenPresent;
    const normalizedPestDetected = typeof pestDetected === 'boolean' ? (pestDetected ? 1 : 0) : pestDetected;

    const result = await db.prepare(`
      INSERT INTO inspections (
        user_id, hive_id, apiary_id, inspection_date, queen_present,
        colony_strength, pest_detected, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      hiveId,
      normalizedApiaryId,
      inspectionDate,
      normalizedQueenPresent,
      colonyStrength || null,
      normalizedPestDetected,
      notes || null
    );

    // Update hive last inspection fields
    await db.prepare(`
      UPDATE hives
      SET last_inspection_date = ?, inspection_overdue = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(inspectionDate, hiveId);

    const inspection = await db.prepare('SELECT * FROM inspections WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ success: true, data: { inspection }, id: inspection.id });
  } catch (error) {
    console.error('Create inspection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/inspections/:id
// @desc    Update inspection
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }

    const {
      inspectionDate,
      queenPresent,
      colonyStrength,
      pestDetected,
      notes,
    } = req.body;

    const normalizedQueenPresent = queenPresent === undefined
      ? existing.queen_present
      : typeof queenPresent === 'boolean'
        ? (queenPresent ? 1 : 0)
        : queenPresent;
    const normalizedPestDetected = pestDetected === undefined
      ? existing.pest_detected
      : typeof pestDetected === 'boolean'
        ? (pestDetected ? 1 : 0)
        : pestDetected;

    await db.prepare(`
      UPDATE inspections
      SET inspection_date = ?, queen_present = ?, colony_strength = ?,
          pest_detected = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      inspectionDate || existing.inspection_date,
      normalizedQueenPresent,
      colonyStrength || existing.colony_strength,
      normalizedPestDetected,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const inspection = await db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { inspection } });
  } catch (error) {
    console.error('Update inspection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/inspections/:id
// @desc    Delete inspection
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM inspections WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Inspection not found' });
    }

    await db.prepare('DELETE FROM inspections WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
