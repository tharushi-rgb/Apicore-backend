// Colony Transfer routes with SQLite database (R7.2)
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// @route   GET /api/transfers
// @desc    Get all colony transfers for the user
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId, hive_id } = req.query;
    const filterHiveId = hiveId || hive_id;

    let transfers;
    if (filterHiveId) {
      transfers = await db.prepare(`
        SELECT ct.*, 
          sh.name as source_hive_name, sh.hive_type as source_hive_type,
          th.name as target_hive_name, th.hive_type as target_hive_type
        FROM colony_transfers ct
        JOIN hives sh ON ct.source_hive_id = sh.id
        JOIN hives th ON ct.target_hive_id = th.id
        WHERE (ct.source_hive_id = ? OR ct.target_hive_id = ?)
        ORDER BY ct.transfer_date DESC
      `).all(filterHiveId, filterHiveId);
    } else {
      transfers = await db.prepare(`
        SELECT ct.*, 
          sh.name as source_hive_name, sh.hive_type as source_hive_type,
          th.name as target_hive_name, th.hive_type as target_hive_type
        FROM colony_transfers ct
        JOIN hives sh ON ct.source_hive_id = sh.id
        JOIN hives th ON ct.target_hive_id = th.id
        WHERE ct.user_id = ?
        ORDER BY ct.transfer_date DESC
      `).all(req.userId);
    }

    res.json({ success: true, data: { transfers } });
  } catch (error) {
    console.error('Get transfers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/transfers
// @desc    Create a colony transfer (pot-to-box, split, merge)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    const sourceHiveId = body.sourceHiveId || body.source_hive_id;
    const targetHiveId = body.targetHiveId || body.target_hive_id;
    const transferDate = body.transferDate || body.transfer_date || new Date().toISOString().split('T')[0];
    const transferType = body.transferType || body.transfer_type || 'pot_to_box';
    const queenMoved = body.queenMoved !== undefined ? (body.queenMoved ? 1 : 0) : 1;
    const broodFramesMoved = body.broodFramesMoved || body.brood_frames_moved || 0;
    const notes = body.notes || null;

    if (!sourceHiveId || !targetHiveId) {
      return res.status(400).json({ success: false, message: 'Source and target hive IDs are required' });
    }

    if (sourceHiveId === targetHiveId) {
      return res.status(400).json({ success: false, message: 'Source and target hive must be different' });
    }

    // Validate source hive
    const sourceHive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(sourceHiveId);
    if (!sourceHive) {
      return res.status(404).json({ success: false, message: 'Source hive not found' });
    }

    // Validate target hive
    const targetHive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(targetHiveId);
    if (!targetHive) {
      return res.status(404).json({ success: false, message: 'Target hive not found' });
    }

    // For pot_to_box: validate types
    if (transferType === 'pot_to_box') {
      if (sourceHive.hive_type !== 'pot') {
        return res.status(400).json({ success: false, message: 'Source hive must be a pot hive for pot-to-box transfer' });
      }
      if (targetHive.hive_type !== 'box') {
        return res.status(400).json({ success: false, message: 'Target hive must be a box hive for pot-to-box transfer' });
      }
    }

    // Create transfer record
    const result = await db.prepare(`
      INSERT INTO colony_transfers (user_id, source_hive_id, target_hive_id, transfer_date, transfer_type, queen_moved, brood_frames_moved, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.userId, sourceHiveId, targetHiveId, transferDate, transferType, queenMoved, broodFramesMoved, notes);

    // Update source hive — mark as inactive/absconded after colony transfer
    if (transferType === 'pot_to_box' || transferType === 'merge') {
      await db.prepare(`
        UPDATE hives SET status = 'inactive', queen_present = 0, colony_strength = 'weak', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(sourceHiveId);
    } else if (transferType === 'split') {
      await db.prepare(`
        UPDATE hives SET colony_strength = 'weak', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(sourceHiveId);
    }

    // Update target hive — receives colony
    if (queenMoved) {
      await db.prepare(`
        UPDATE hives SET queen_present = 1, status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(targetHiveId);

      // If queen exists in queens table, move her
      const activeQueen = await db.prepare("SELECT * FROM queens WHERE hive_id = ? AND status = 'active'").get(sourceHiveId);
      if (activeQueen) {
        await db.prepare("UPDATE queens SET hive_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetHiveId, activeQueen.id);
      }
    }

    const transfer = await db.prepare(`
      SELECT ct.*, 
        sh.name as source_hive_name, sh.hive_type as source_hive_type,
        th.name as target_hive_name, th.hive_type as target_hive_type
      FROM colony_transfers ct
      JOIN hives sh ON ct.source_hive_id = sh.id
      JOIN hives th ON ct.target_hive_id = th.id
      WHERE ct.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ success: true, message: 'Colony transfer recorded', data: { transfer } });
  } catch (error) {
    console.error('Create transfer error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
