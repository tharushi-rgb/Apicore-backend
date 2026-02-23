// Client Services routes (R15)
import express from 'express';
import { db, authenticateToken, sendError } from '../shared.js';

const router = express.Router();

// Helper: create notification
async function createNotification(userId, type, severity, title, message, relatedType, relatedId) {
  await db.prepare(`
    INSERT INTO notifications (user_id, notification_type, severity, title, message, related_type, related_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, severity, title, message, relatedType, relatedId);
}

// @route   GET /api/clients
// @desc    Get all client services for admin, or assigned tasks for helper
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const isHelper = user && user.role === 'helper';

    let services;
    if (isHelper) {
      services = await db.prepare(`
        SELECT cs.*, u.name as assigned_to_name
        FROM client_services cs
        LEFT JOIN users u ON cs.assigned_to = u.id
        WHERE cs.assigned_to = ?
        ORDER BY cs.created_at DESC
      `).all(req.userId);
    } else {
      services = await db.prepare(`
        SELECT cs.*, u.name as assigned_to_name
        FROM client_services cs
        LEFT JOIN users u ON cs.assigned_to = u.id
        WHERE cs.user_id = ?
        ORDER BY cs.created_at DESC
      `).all(req.userId);
    }

    res.json({ success: true, data: { services } });
  } catch (error) {
    console.error('Get client services error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/clients/:id
// @desc    Get single client service
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const service = await db.prepare(`
      SELECT cs.*, u.name as assigned_to_name
      FROM client_services cs
      LEFT JOIN users u ON cs.assigned_to = u.id
      WHERE cs.id = ?
    `).get(req.params.id);

    if (!service) {
      return res.status(404).json({ success: false, message: 'Client service not found' });
    }

    res.json({ success: true, data: { service } });
  } catch (error) {
    console.error('Get client service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/clients
// @desc    Create new client service (admin only)
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (user && user.role === 'helper') {
      return res.status(403).json({ success: false, message: 'Only admin/beekeeper can create client services' });
    }

    const body = req.body || {};
    const clientName = body.clientName || body.client_name;
    const clientContact = body.clientContact || body.client_contact || null;
    const clientEmail = body.clientEmail || body.client_email || null;
    const serviceType = body.serviceType || body.service_type;
    const description = body.description || null;
    const location = body.location || null;
    const gpsLatitude = body.gpsLatitude || body.gps_latitude || null;
    const gpsLongitude = body.gpsLongitude || body.gps_longitude || null;
    const assignedTo = body.assignedTo || body.assigned_to || null;
    const priority = body.priority || 'normal';
    const scheduledDate = body.scheduledDate || body.scheduled_date || null;
    const paymentAmount = body.paymentAmount || body.payment_amount || null;
    const expenseProofRequired = body.expenseProofRequired ? 1 : 0;
    const notes = body.notes || null;

    if (!clientName || !serviceType) {
      return res.status(400).json({ success: false, message: 'Client name and service type are required' });
    }

    const status = assignedTo ? 'assigned' : 'pending';

    const result = await db.prepare(`
      INSERT INTO client_services (
        user_id, client_name, client_contact, client_email,
        service_type, description, location, gps_latitude, gps_longitude,
        assigned_to, status, priority, scheduled_date,
        payment_amount, expense_proof_required, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId, clientName, clientContact, clientEmail,
      serviceType, description, location, gpsLatitude, gpsLongitude,
      assignedTo, status, priority, scheduledDate,
      paymentAmount, expenseProofRequired, notes
    );

    const service = await db.prepare('SELECT * FROM client_services WHERE id = ?').get(result.lastInsertRowid);

    // If assigned, notify the assignee
    if (assignedTo) {
      createNotification(
        assignedTo, 'task_assigned', 'info',
        'New Task Assigned',
        `You have been assigned a ${serviceType.replace('_', ' ')} service for ${clientName}`,
        'client_service', service.id
      );
    }

    res.status(201).json({ success: true, message: 'Client service created', data: { service } });
  } catch (error) {
    console.error('Create client service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/clients/:id
// @desc    Update client service
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM client_services WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Client service not found' });
    }

    const body = req.body;
    await db.prepare(`
      UPDATE client_services
      SET client_name = ?, client_contact = ?, client_email = ?,
          service_type = ?, description = ?, location = ?,
          gps_latitude = ?, gps_longitude = ?,
          assigned_to = ?, status = ?, priority = ?,
          scheduled_date = ?, payment_amount = ?, payment_status = ?,
          expense_proof_required = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      body.clientName || existing.client_name,
      body.clientContact !== undefined ? body.clientContact : existing.client_contact,
      body.clientEmail !== undefined ? body.clientEmail : existing.client_email,
      body.serviceType || existing.service_type,
      body.description !== undefined ? body.description : existing.description,
      body.location !== undefined ? body.location : existing.location,
      body.gpsLatitude !== undefined ? body.gpsLatitude : existing.gps_latitude,
      body.gpsLongitude !== undefined ? body.gpsLongitude : existing.gps_longitude,
      body.assignedTo !== undefined ? body.assignedTo : existing.assigned_to,
      body.status || existing.status,
      body.priority || existing.priority,
      body.scheduledDate !== undefined ? body.scheduledDate : existing.scheduled_date,
      body.paymentAmount !== undefined ? body.paymentAmount : existing.payment_amount,
      body.paymentStatus || existing.payment_status,
      body.expenseProofRequired !== undefined ? (body.expenseProofRequired ? 1 : 0) : existing.expense_proof_required,
      body.notes !== undefined ? body.notes : existing.notes,
      req.params.id
    );

    const service = await db.prepare(`
      SELECT cs.*, u.name as assigned_to_name
      FROM client_services cs
      LEFT JOIN users u ON cs.assigned_to = u.id
      WHERE cs.id = ?
    `).get(req.params.id);

    // Notify on status change
    if (body.status && body.status !== existing.status) {
      // Auto-record as income when completed via PUT
      if (body.status === 'completed' && existing.status !== 'completed') {
        const payAmt = body.paymentAmount !== undefined ? body.paymentAmount : existing.payment_amount;
        if (payAmt) {
          try {
            const cDate = new Date().toISOString().split('T')[0];
            await db.prepare(`
              INSERT INTO income (
                user_id, income_date, income_type, amount, description, notes
              ) VALUES (?, ?, 'client_service', ?, ?, ?)
            `).run(
              existing.user_id, cDate, payAmt,
              `Client Service: ${existing.service_type.replace('_', ' ')} for ${existing.client_name}`,
              `Auto-recorded from completed client service #${existing.id}`
            );
          } catch (incErr) { console.error('Auto-record income error (non-fatal):', incErr); }
        }
      }

      // Notify admin if helper updates status
      if (existing.user_id !== req.userId) {
        createNotification(
          existing.user_id, 'task_status', 'info',
          'Task Status Updated',
          `${existing.service_type.replace('_', ' ')} service for ${existing.client_name} is now ${body.status}`,
          'client_service', existing.id
        );
      }
      // Notify helper if admin updates status
      if (existing.assigned_to && existing.assigned_to !== req.userId) {
        createNotification(
          existing.assigned_to, 'task_status', 'info',
          'Task Status Updated',
          `${existing.service_type.replace('_', ' ')} service for ${existing.client_name} is now ${body.status}`,
          'client_service', existing.id
        );
      }
    }

    // Notify new assignee if assignment changed
    if (body.assignedTo && body.assignedTo !== existing.assigned_to) {
      createNotification(
        body.assignedTo, 'task_assigned', 'info',
        'New Task Assigned',
        `You have been assigned a ${existing.service_type.replace('_', ' ')} service for ${existing.client_name}`,
        'client_service', existing.id
      );
    }

    res.json({ success: true, message: 'Client service updated', data: { service } });
  } catch (error) {
    console.error('Update client service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/clients/:id/status
// @desc    Update status only (for helpers updating task progress)
// @access  Private
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM client_services WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Client service not found' });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const completedDate = status === 'completed' ? new Date().toISOString().split('T')[0] : existing.completed_date;

    await db.prepare(`
      UPDATE client_services SET status = ?, completed_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, completedDate, req.params.id);

    // Auto-record client service as income when completed (R15 auto-record)
    if (status === 'completed' && existing.payment_amount && existing.status !== 'completed') {
      try {
        await db.prepare(`
          INSERT INTO income (
            user_id, income_date, income_type, amount, description, notes
          ) VALUES (?, ?, 'client_service', ?, ?, ?)
        `).run(
          existing.user_id,
          completedDate,
          existing.payment_amount,
          `Client Service: ${existing.service_type.replace('_', ' ')} for ${existing.client_name}`,
          `Auto-recorded from completed client service #${existing.id}`
        );
      } catch (incomeErr) {
        console.error('Auto-record income error (non-fatal):', incomeErr);
      }
    }

    const service = await db.prepare(`
      SELECT cs.*, u.name as assigned_to_name
      FROM client_services cs
      LEFT JOIN users u ON cs.assigned_to = u.id
      WHERE cs.id = ?
    `).get(req.params.id);

    // Notify admin of status change
    if (existing.user_id !== req.userId) {
      const user = await db.prepare('SELECT name FROM users WHERE id = ?').get(req.userId);
      createNotification(
        existing.user_id, 'task_status', status === 'completed' ? 'info' : 'warning',
        'Task Status Updated',
        `${user?.name || 'Helper'} updated "${existing.client_name}" service to ${status}`,
        'client_service', existing.id
      );
    }

    res.json({ success: true, message: 'Status updated', data: { service } });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/clients/:id
// @desc    Delete client service
// @access  Private (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM client_services WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Client service not found' });
    }

    await db.prepare('DELETE FROM client_services WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Client service deleted' });
  } catch (error) {
    console.error('Delete client service error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
