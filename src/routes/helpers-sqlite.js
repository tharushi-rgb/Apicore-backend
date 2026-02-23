// Helper management routes
import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db, authenticateToken, sendError } from '../shared.js';

const router = express.Router();

// ── INVITATION ENDPOINTS ──────────────────────────────────────────────

// @route   POST /api/helpers/invite
// @desc    Admin creates a helper invitation
// @access  Private (admin only)
router.post('/invite', authenticateToken, async (req, res) => {
  try {
    const admin = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!admin || admin.role === 'helper') {
      return res.status(403).json({ success: false, message: 'Only admin/beekeeper users can invite helpers' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Check if already registered
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    // Check if pending invitation already exists
    const existingInvite = await db.prepare("SELECT id FROM helper_invitations WHERE email = ? AND status = 'pending'").get(email);
    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'An invitation is already pending for this email' });
    }

    // Generate token (8 char uppercase alphanumeric)
    const token = crypto.randomBytes(4).toString('hex').toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    await db.prepare(`
      INSERT INTO helper_invitations (invited_by, email, token, status, expires_at)
      VALUES (?, ?, ?, 'pending', ?)
    `).run(req.userId, email, token, expiresAt);

    res.status(201).json({
      success: true,
      message: 'Invitation created successfully',
      data: { token, email, expiresAt }
    });
  } catch (error) {
    console.error('Create invitation error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/helpers/invitations
// @desc    Get all invitations created by admin
// @access  Private (admin)
router.get('/invitations', authenticateToken, async (req, res) => {
  try {
    const invitations = await db.prepare(`
      SELECT hi.*, u.name as invited_by_name
      FROM helper_invitations hi
      LEFT JOIN users u ON hi.invited_by = u.id
      WHERE hi.invited_by = ?
      ORDER BY hi.created_at DESC
    `).all(req.userId);

    res.json({ success: true, data: { invitations } });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/helpers/verify-token
// @desc    Verify an invitation token (public — for registration form)
// @access  Public
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const invitation = await db.prepare(`
      SELECT hi.*, u.name as invited_by_name
      FROM helper_invitations hi
      LEFT JOIN users u ON hi.invited_by = u.id
      WHERE hi.token = ?
    `).get(token.toUpperCase().trim());

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invalid invitation token' });
    }

    if (invitation.status === 'accepted') {
      return res.status(400).json({ success: false, message: 'This invitation has already been used' });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.prepare("UPDATE helper_invitations SET status = 'expired' WHERE id = ?").run(invitation.id);
      return res.status(400).json({ success: false, message: 'This invitation has expired' });
    }

    res.json({
      success: true,
      data: {
        email: invitation.email,
        invitedBy: invitation.invited_by_name,
        token: invitation.token
      }
    });
  } catch (error) {
    console.error('Verify token error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/helpers/register
// @desc    Helper registers using a valid invitation token
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { token, name, password, phone, district } = req.body;

    if (!token || !name || !password) {
      return res.status(400).json({ success: false, message: 'Token, name, and password are required' });
    }

    // Find invitation
    const invitation = await db.prepare("SELECT * FROM helper_invitations WHERE token = ? AND status = 'pending'")
      .get(token.toUpperCase().trim());

    if (!invitation) {
      return res.status(400).json({ success: false, message: 'Invalid or expired invitation token' });
    }

    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.prepare("UPDATE helper_invitations SET status = 'expired' WHERE id = ?").run(invitation.id);
      return res.status(400).json({ success: false, message: 'This invitation has expired' });
    }

    // Check if email already registered
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(invitation.email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }

    // Create helper user
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.prepare(`
      INSERT INTO users (name, email, password, phone, district, role)
      VALUES (?, ?, ?, ?, ?, 'helper')
    `).run(name, hashedPassword, invitation.email, phone || null, district || null);

    // Mark invitation as accepted
    await db.prepare("UPDATE helper_invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(invitation.id);

    const user = await db.prepare('SELECT id, name, email, phone, district, role FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'Helper registered successfully. You can now log in.',
      data: { user }
    });
  } catch (error) {
    console.error('Helper register error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── ASSIGNMENT ENDPOINTS ──────────────────────────────────────────────

// @route   GET /api/helpers
// @desc    Get all helpers (for admin to manage)
// @access  Private (admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const helpers = await db.prepare(`
      SELECT id, name, email, phone, district, role, created_at
      FROM users WHERE role = 'helper'
      ORDER BY name ASC
    `).all();

    // Get assignment counts
    const helpersWithCounts = [];
    for (const h of helpers) {
      const row = await db.prepare(
        "SELECT COUNT(*) as count FROM hive_assignments WHERE helper_id = ? AND status = 'active'"
      ).get(h.id);
      helpersWithCounts.push({ ...h, assignment_count: row ? row.count : 0 });
    }

    res.json({ success: true, data: { helpers: helpersWithCounts } });
  } catch (error) {
    console.error('Get helpers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/helpers/assign
// @desc    Assign hive(s) to a helper
// @access  Private (admin)
router.post('/assign', authenticateToken, async (req, res) => {
  try {
    const { helperId, hiveIds, notes } = req.body;
    if (!helperId || !hiveIds || !Array.isArray(hiveIds) || hiveIds.length === 0) {
      return res.status(400).json({ success: false, message: 'helperId and hiveIds array are required' });
    }

    // Verify helper exists
    const helper = await db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'helper'").get(helperId);
    if (!helper) {
      return res.status(404).json({ success: false, message: 'Helper not found' });
    }

    const insertStmt = await db.prepare(`
      INSERT INTO hive_assignments (hive_id, helper_id, assigned_by, notes)
      VALUES (?, ?, ?, ?)
    `);

    // Revoke existing assignments for these hives to this helper first to avoid duplicates
    const revokeStmt = await db.prepare(
      "UPDATE hive_assignments SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE hive_id = ? AND helper_id = ? AND status = 'active'"
    );

    let assigned = 0;
    for (const hiveId of hiveIds) {
      const hive = await db.prepare('SELECT id FROM hives WHERE id = ?').get(hiveId);
      if (hive) {
        revokeStmt.run(hiveId, helperId);
        insertStmt.run(hiveId, helperId, req.userId, notes || null);
        assigned++;
      }
    }

    res.json({
      success: true,
      message: `${assigned} hive(s) assigned to ${helper.name}`,
      data: { assigned }
    });
  } catch (error) {
    console.error('Assign hives error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/helpers/assign/:assignmentId
// @desc    Revoke a hive assignment
// @access  Private (admin)
router.delete('/assign/:assignmentId', authenticateToken, async (req, res) => {
  try {
    const assignment = await db.prepare('SELECT * FROM hive_assignments WHERE id = ?').get(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    await db.prepare("UPDATE hive_assignments SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(req.params.assignmentId);

    res.json({ success: true, message: 'Assignment revoked' });
  } catch (error) {
    console.error('Revoke assignment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/helpers/my-assignments
// @desc    Get assignments for the logged-in helper
// @access  Private (helper)
router.get('/my-assignments', authenticateToken, async (req, res) => {
  try {
    const assignments = await db.prepare(`
      SELECT ha.*, h.name as hive_name, h.hive_type, h.status as hive_status,
             h.colony_strength, h.queen_present, h.pest_detected,
             h.last_inspection_date, h.inspection_overdue,
             a.name as apiary_name, a.district as apiary_district
      FROM hive_assignments ha
      JOIN hives h ON ha.hive_id = h.id
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE ha.helper_id = ? AND ha.status = 'active'
      ORDER BY a.name ASC, h.name ASC
    `).all(req.userId);

    res.json({ success: true, data: { assignments } });
  } catch (error) {
    console.error('Get my assignments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/helpers/my-dashboard
// @desc    Get helper-specific dashboard data (only assigned hives + their apiaries)
// @access  Private (helper)
router.get('/my-dashboard', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, name, email, phone, district, role FROM users WHERE id = ?').get(req.userId);

    // Get assigned hive IDs
    const assignedRows = await db.prepare(
      "SELECT DISTINCT hive_id FROM hive_assignments WHERE helper_id = ? AND status = 'active'"
    ).all(req.userId);
    const assignedHiveIds = assignedRows.map(r => r.hive_id);

    if (assignedHiveIds.length === 0) {
      return res.json({
        success: true,
        data: {
          user,
          stats: { assignedHives: 0, activeHives: 0, assignedApiaries: 0, pendingInspections: 0, recentInspections: 0 },
          hives: [],
          apiaries: [],
          recentInspections: []
        }
      });
    }

    const placeholders = assignedHiveIds.map(() => '?').join(',');

    // Get hives
    const hives = await db.prepare(`
      SELECT h.*, a.name as apiary_name, a.district as apiary_district
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.id IN (${placeholders})
      ORDER BY h.name ASC
    `).all(...assignedHiveIds);

    // Get unique apiaries
    const apiaryIds = [...new Set(hives.map(h => h.apiary_id).filter(Boolean))];
    let apiaries = [];
    if (apiaryIds.length > 0) {
      const apiaryPlaceholders = apiaryIds.map(() => '?').join(',');
      apiaries = await db.prepare(`
        SELECT a.*, (SELECT COUNT(*) FROM hives WHERE apiary_id = a.id) as hive_count
        FROM apiaries a WHERE a.id IN (${apiaryPlaceholders})
      `).all(...apiaryIds);
    }

    // Stats
    const activeHives = hives.filter(h => h.status === 'active').length;
    const pendingInspections = hives.filter(h => h.inspection_overdue).length;

    // Recent inspections on assigned hives
    const recentInspections = await db.prepare(`
      SELECT i.*, h.name as hive_name
      FROM inspections i
      JOIN hives h ON i.hive_id = h.id
      WHERE i.hive_id IN (${placeholders})
      ORDER BY i.created_at DESC LIMIT 10
    `).all(...assignedHiveIds);

    res.json({
      success: true,
      data: {
        user,
        stats: {
          assignedHives: assignedHiveIds.length,
          activeHives,
          assignedApiaries: apiaries.length,
          pendingInspections,
          recentInspections: recentInspections.length
        },
        hives,
        apiaries,
        recentInspections
      }
    });
  } catch (error) {
    console.error('Helper dashboard error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/helpers/:helperId/assignments
// @desc    Get all assignments for a specific helper (admin view)
// @access  Private (admin)
router.get('/:helperId/assignments', authenticateToken, async (req, res) => {
  try {
    const assignments = await db.prepare(`
      SELECT ha.*, h.name as hive_name, h.hive_type, h.status as hive_status,
             a.name as apiary_name
      FROM hive_assignments ha
      JOIN hives h ON ha.hive_id = h.id
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE ha.helper_id = ? AND ha.status = 'active'
      ORDER BY ha.assigned_at DESC
    `).all(req.params.helperId);

    res.json({ success: true, data: { assignments } });
  } catch (error) {
    console.error('Get helper assignments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
