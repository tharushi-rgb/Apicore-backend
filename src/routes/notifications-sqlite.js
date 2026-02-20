// Notifications & Alerts routes with SQLite database (R16)
import express from 'express';
import { createRequire } from 'module';
import { authenticateToken } from './auth-sqlite.js';

const require = createRequire(import.meta.url);
const db = require('../config/database.cjs');

const router = express.Router();

// ── AUTO-GENERATE NOTIFICATIONS ─────────────────────────────────────────

function generateAutomatedAlerts(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;

  const isHelper = user.role === 'helper';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // ─── For Admin (Beekeeper) ─────────────────────────────────────

  if (!isHelper) {
    // 1. Inspection overdue alerts (no inspection in 14+ days)
    const overdueHives = db.prepare(`
      SELECT h.id, h.name, a.name as apiary_name,
        CAST(julianday('now') - julianday(COALESCE(h.last_inspection_date, h.created_at)) AS INTEGER) as days_since
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.status = 'active'
        AND CAST(julianday('now') - julianday(COALESCE(h.last_inspection_date, h.created_at)) AS INTEGER) >= 14
    `).all();

    for (const hive of overdueHives) {
      const exists = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND notification_type = 'inspection_due' AND related_id = ?
          AND date(created_at) = date('now')
      `).get(userId, hive.id);

      if (!exists) {
        db.prepare(`
          INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
          VALUES (?, 'inspection_due', ?, ?, ?, 'hive', ?)
        `).run(
          userId,
          hive.days_since >= 30 ? 'critical' : 'warning',
          'Inspection Overdue',
          `${hive.name}${hive.apiary_name ? ' (' + hive.apiary_name + ')' : ''} — ${hive.days_since} days since last inspection`,
          hive.id
        );
      }
    }

    // 2. Queen age alerts (R16.2: green<1, yellow 1-1.5, red>2)
    const queens = db.prepare(`
      SELECT q.id, q.hive_id, q.introduction_date, h.name as hive_name,
        CAST(julianday('now') - julianday(q.introduction_date) AS REAL) / 365.0 as age_years
      FROM queens q
      JOIN hives h ON q.hive_id = h.id
      WHERE q.status = 'active' AND q.introduction_date IS NOT NULL
    `).all();

    for (const queen of queens) {
      if (queen.age_years >= 1.0) {
        const severity = queen.age_years >= 2 ? 'critical' : queen.age_years >= 1.5 ? 'warning' : 'info';
        const label = queen.age_years >= 2 ? '🔴 Replace Urgently' : queen.age_years >= 1.5 ? '🟡 Consider Replacing' : '🟢 Monitor';

        const exists = db.prepare(`
          SELECT id FROM notifications
          WHERE user_id = ? AND notification_type = 'queen_age' AND related_id = ?
            AND date(created_at) >= date('now', '-7 days')
        `).get(userId, queen.hive_id);

        if (!exists) {
          db.prepare(`
            INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
            VALUES (?, 'queen_age', ?, ?, ?, 'hive', ?)
          `).run(
            userId, severity,
            'Queen Age Alert',
            `${queen.hive_name} — Queen is ${queen.age_years.toFixed(1)} years old. ${label}`,
            queen.hive_id
          );
        }
      }
    }

    // 3. Pest activity alerts (R16.1 — if helper flagged pest during inspection)
    const pestHives = db.prepare(`
      SELECT h.id, h.name, a.name as apiary_name
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.pest_detected = 1
    `).all();

    for (const hive of pestHives) {
      const exists = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND notification_type = 'pest_alert' AND related_id = ?
          AND date(created_at) >= date('now', '-3 days')
      `).get(userId, hive.id);

      if (!exists) {
        db.prepare(`
          INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
          VALUES (?, 'pest_alert', 'critical', ?, ?, 'hive', ?)
        `).run(
          userId,
          'Pest Activity Detected',
          `${hive.name}${hive.apiary_name ? ' (' + hive.apiary_name + ')' : ''} has pest activity flagged`,
          hive.id
        );
      }
    }

    // 4. Feeding reminders (no feeding in 21+ days for active hives)
    const unfedHives = db.prepare(`
      SELECT h.id, h.name, a.name as apiary_name,
        (SELECT MAX(feeding_date) FROM feedings WHERE hive_id = h.id) as last_fed,
        CAST(julianday('now') - julianday(COALESCE(
          (SELECT MAX(feeding_date) FROM feedings WHERE hive_id = h.id),
          h.created_at
        )) AS INTEGER) as days_since_fed
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.status = 'active'
        AND CAST(julianday('now') - julianday(COALESCE(
          (SELECT MAX(feeding_date) FROM feedings WHERE hive_id = h.id),
          h.created_at
        )) AS INTEGER) >= 21
    `).all();

    for (const hive of unfedHives) {
      const exists = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND notification_type = 'feeding_due' AND related_id = ?
          AND date(created_at) >= date('now', '-7 days')
      `).get(userId, hive.id);

      if (!exists) {
        db.prepare(`
          INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
          VALUES (?, 'feeding_due', 'warning', ?, ?, 'hive', ?)
        `).run(
          userId,
          'Feeding Reminder',
          `${hive.name}${hive.apiary_name ? ' (' + hive.apiary_name + ')' : ''} — ${hive.days_since_fed} days since last feeding`,
          hive.id
        );
      }
    }

    // 5. Queenless hive alerts
    const queenlessHives = db.prepare(`
      SELECT h.id, h.name, a.name as apiary_name
      FROM hives h
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE h.status = 'queenless' OR (h.queen_present = 0 AND h.status = 'active')
    `).all();

    for (const hive of queenlessHives) {
      const exists = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND notification_type = 'queen_age' AND related_id = ? AND title = 'Queenless Hive'
          AND date(created_at) >= date('now', '-7 days')
      `).get(userId, hive.id);

      if (!exists) {
        db.prepare(`
          INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
          VALUES (?, 'queen_age', 'critical', ?, ?, 'hive', ?)
        `).run(
          userId,
          'Queenless Hive',
          `${hive.name}${hive.apiary_name ? ' (' + hive.apiary_name + ')' : ''} has no active queen. Add a queen soon.`,
          hive.id
        );
      }
    }
  }

  // ─── For Helpers ─────────────────────────────────────────────────

  if (isHelper) {
    // Inspection overdue on assigned hives
    const assignedOverdue = db.prepare(`
      SELECT h.id, h.name, a.name as apiary_name,
        CAST(julianday('now') - julianday(COALESCE(h.last_inspection_date, h.created_at)) AS INTEGER) as days_since
      FROM hive_assignments ha
      JOIN hives h ON ha.hive_id = h.id
      LEFT JOIN apiaries a ON h.apiary_id = a.id
      WHERE ha.helper_id = ? AND ha.status = 'active' AND h.status = 'active'
        AND CAST(julianday('now') - julianday(COALESCE(h.last_inspection_date, h.created_at)) AS INTEGER) >= 14
    `).all(userId);

    for (const hive of assignedOverdue) {
      const exists = db.prepare(`
        SELECT id FROM notifications
        WHERE user_id = ? AND notification_type = 'inspection_due' AND related_id = ?
          AND date(created_at) = date('now')
      `).get(userId, hive.id);

      if (!exists) {
        db.prepare(`
          INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
          VALUES (?, 'inspection_due', 'warning', ?, ?, 'hive', ?)
        `).run(
          userId,
          'Inspection Overdue',
          `${hive.name}${hive.apiary_name ? ' (' + hive.apiary_name + ')' : ''} — ${hive.days_since} days since last inspection`,
          hive.id
        );
      }
    }
  }
}

// @route   GET /api/notifications
// @desc    Get notifications for current user (auto-generates fresh alerts)
// @access  Private
router.get('/', authenticateToken, (req, res) => {
  try {
    // Auto-generate fresh alerts
    generateAutomatedAlerts(req.userId);

    const { unreadOnly } = req.query;
    let notifications;

    if (unreadOnly === 'true') {
      notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? AND is_read = 0 AND is_dismissed = 0
        ORDER BY created_at DESC
        LIMIT 50
      `).all(req.userId);
    } else {
      notifications = db.prepare(`
        SELECT * FROM notifications
        WHERE user_id = ? AND is_dismissed = 0
        ORDER BY created_at DESC
        LIMIT 100
      `).all(req.userId);
    }

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0 AND is_dismissed = 0
    `).get(req.userId).count;

    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/notifications/:id/read
// @desc    Mark notification as read
// @access  Private
router.patch('/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.patch('/read-all', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.userId);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/notifications/:id/dismiss
// @desc    Dismiss notification
// @access  Private
router.patch('/:id/dismiss', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_dismissed = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
    res.json({ success: true, message: 'Notification dismissed' });
  } catch (error) {
    console.error('Dismiss error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/notifications/clear
// @desc    Clear all dismissed/read notifications older than 30 days
// @access  Private
router.delete('/clear', authenticateToken, (req, res) => {
  try {
    db.prepare(`
      DELETE FROM notifications
      WHERE user_id = ? AND (is_dismissed = 1 OR (is_read = 1 AND created_at < datetime('now', '-30 days')))
    `).run(req.userId);
    res.json({ success: true, message: 'Old notifications cleared' });
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
