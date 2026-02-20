// Apiaries routes with SQLite database
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// Helper: log apiary history
function logApiaryHistory(apiaryId, userId, action, details) {
  try {
    db.prepare(`
      INSERT INTO apiary_history (apiary_id, user_id, action, details)
      VALUES (?, ?, ?, ?)
    `).run(apiaryId, userId, action, typeof details === 'object' ? JSON.stringify(details) : details);
  } catch (err) {
    console.error('Failed to log apiary history:', err);
  }
}

// @route   GET /api/apiaries
// @desc    Get all apiaries (admin view)
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    const apiaries = db.prepare(`
      SELECT a.*, 
             (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id) as hive_count 
      FROM apiaries a 
      ORDER BY created_at DESC
    `).all();
    
    res.json({
      success: true,
      data: { apiaries }
    });
  } catch (error) {
    console.error('Get apiaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/apiaries/:id
// @desc    Get single apiary by ID (admin view)
// @access  Private
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const apiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(req.params.id);
    
    if (!apiary) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    res.json({
      success: true,
      data: { apiary }
    });
  } catch (error) {
    console.error('Get apiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/apiaries
// @desc    Create new apiary
// @access  Private
router.post('/', authenticateToken, (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const name = body.name;
    const district = body.district || (body.location ? String(body.location).split(',')[0]?.trim() : undefined);
    const area = body.area || body.location || null;
    const establishedDate = body.establishedDate || body.established_date || null;
    const status = body.status || 'active';
    const apiaryType = body.apiaryType || body.apiary_type || 'personal';
    const terrain = body.terrain || null;
    const foragePrimary = body.foragePrimary || body.forage_primary || null;
    const bloomingWindow = body.bloomingWindow || body.blooming_window || null;
    const gpsLatitude = body.gpsLatitude || body.gps_latitude || null;
    const gpsLongitude = body.gpsLongitude || body.gps_longitude || null;

    // Validate required fields
    if (!name || !district) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name and district'
      });
    }

    // Insert new apiary
    const result = db.prepare(`
      INSERT INTO apiaries (
        user_id, name, district, area, established_date, status, 
        apiary_type, terrain, forage_primary, blooming_window,
        gps_latitude, gps_longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId, name, district, area, establishedDate, status,
      apiaryType, terrain, foragePrimary, bloomingWindow,
      gpsLatitude, gpsLongitude
    );

    // Get the created apiary
    const apiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(result.lastInsertRowid);

    // Log history
    logApiaryHistory(apiary.id, req.userId, 'created', `Apiary "${name}" created in ${district}`);

    res.status(201).json({
      success: true,
      message: 'Apiary created successfully',
      data: { apiary },
      id: apiary.id // convenience for existing Postman tests
    });
  } catch (error) {
    console.error('Create apiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/apiaries/:id
// @desc    Update apiary
// @access  Private
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const {
      name,
      district,
      area,
      establishedDate,
      status,
      apiaryType,
      terrain,
      foragePrimary,
      bloomingWindow,
      gpsLatitude,
      gpsLongitude
    } = req.body;

    // Check if apiary exists and belongs to user
    const existingApiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(req.params.id);
    
    if (!existingApiary) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    // R4.1: Block setting apiary to inactive if it has active hives
    const newStatus = status || existingApiary.status;
    if (newStatus === 'inactive' && existingApiary.status !== 'inactive') {
      const activeHiveCount = db.prepare(
        "SELECT COUNT(*) as count FROM hives WHERE apiary_id = ? AND status = 'active'"
      ).get(req.params.id);
      if (activeHiveCount && activeHiveCount.count > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot set apiary to inactive — it has ${activeHiveCount.count} active hive(s). Move or deactivate them first.`
        });
      }
    }

    // Update apiary
    db.prepare(`
      UPDATE apiaries 
      SET name = ?, district = ?, area = ?, established_date = ?, status = ?,
          apiary_type = ?, terrain = ?, forage_primary = ?, blooming_window = ?,
          gps_latitude = ?, gps_longitude = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name || existingApiary.name,
      district || existingApiary.district,
      area !== undefined ? area : existingApiary.area,
      establishedDate || existingApiary.established_date,
      status || existingApiary.status,
      apiaryType || existingApiary.apiary_type,
      terrain !== undefined ? terrain : existingApiary.terrain,
      foragePrimary !== undefined ? foragePrimary : existingApiary.forage_primary,
      bloomingWindow !== undefined ? bloomingWindow : existingApiary.blooming_window,
      gpsLatitude !== undefined ? gpsLatitude : existingApiary.gps_latitude,
      gpsLongitude !== undefined ? gpsLongitude : existingApiary.gps_longitude,
      req.params.id
    );

    // Get updated apiary
    const apiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(req.params.id);

    // Log history — build change summary
    const changes = [];
    if (name && name !== existingApiary.name) changes.push(`name: "${existingApiary.name}" → "${name}"`);
    if (status && status !== existingApiary.status) changes.push(`status: ${existingApiary.status} → ${status}`);
    if (district && district !== existingApiary.district) changes.push(`district changed`);
    const details = changes.length > 0 ? changes.join(', ') : 'Apiary details updated';
    const action = (status && status !== existingApiary.status) ? 'status_change' : 'updated';
    logApiaryHistory(Number(req.params.id), req.userId, action, details);

    res.json({
      success: true,
      message: 'Apiary updated successfully',
      data: { apiary }
    });
  } catch (error) {
    console.error('Update apiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/apiaries/:id
// @desc    Delete apiary
// @access  Private
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    // Check if apiary exists and belongs to user
    const apiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(req.params.id);
    
    if (!apiary) {
      return res.status(404).json({
        success: false,
        message: 'Apiary not found'
      });
    }

    // Log history before deletion
    logApiaryHistory(Number(req.params.id), req.userId, 'deleted', `Apiary "${apiary.name}" deleted`);

    // Delete apiary (this will cascade delete related hives due to foreign key)
    db.prepare('DELETE FROM apiaries WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      message: 'Apiary deleted successfully'
    });
  } catch (error) {
    console.error('Delete apiary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/apiaries/:id/history
// @desc    Get history log for an apiary
// @access  Private
router.get('/:id/history', authenticateToken, (req, res) => {
  try {
    const apiary = db.prepare('SELECT * FROM apiaries WHERE id = ?').get(req.params.id);
    if (!apiary) {
      return res.status(404).json({ success: false, message: 'Apiary not found' });
    }

    const history = db.prepare(`
      SELECT ah.*, u.name as user_name
      FROM apiary_history ah
      LEFT JOIN users u ON ah.user_id = u.id
      WHERE ah.apiary_id = ?
      ORDER BY ah.created_at DESC
    `).all(req.params.id);

    res.json({ success: true, data: { history } });
  } catch (error) {
    console.error('Get apiary history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
