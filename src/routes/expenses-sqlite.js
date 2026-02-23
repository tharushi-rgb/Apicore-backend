// Expenses routes
import express from 'express';
import { db, authenticateToken, sendError } from '../shared.js';

const router = express.Router();

// @route   GET /api/expenses
// @desc    Get expenses (admin view, optional hiveId/apiaryId)
// @access  Private
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { hiveId, apiaryId } = req.query;

    const query = `
      SELECT e.*, hv.name as hive_name, a.name as apiary_name
      FROM expenses e
      LEFT JOIN hives hv ON e.hive_id = hv.id
      LEFT JOIN apiaries a ON e.apiary_id = a.id
      WHERE 1 = 1
      ${hiveId ? 'AND e.hive_id = ?' : ''}
      ${apiaryId ? 'AND e.apiary_id = ?' : ''}
      ORDER BY e.expense_date DESC
    `;

    const params = [];
    if (hiveId) params.push(hiveId);
    if (apiaryId) params.push(apiaryId);

    const expenses = await db.prepare(query).all(...params);
    res.json({ success: true, data: { expenses } });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/expenses
// @desc    Create new expense
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const body = req.body || {};
    // Accept both camelCase and snake_case payloads from Postman
    const hiveId = body.hiveId || body.hive_id;
    const apiaryId = body.apiaryId || body.apiary_id;
    const expenseDate = body.expenseDate || body.expense_date || body.date;
    const expenseType = body.expenseType || body.expense_type || body.category;
    const amount = body.amount !== undefined ? body.amount : body.cost !== undefined ? body.cost : body.total;
    const description = body.description || body.item || body.payment_method || null;
    const receiptImage = body.receiptImage || body.receipt_image || null;
    const notes = body.notes || null;

    if (!expenseDate || !expenseType || amount === undefined) {
      return res.status(400).json({ success: false, message: 'Date, type, and amount are required' });
    }

    const normalizedHiveId = hiveId ? Number(hiveId) : null;
    const normalizedApiaryId = apiaryId ? Number(apiaryId) : null;

    if (normalizedHiveId) {
      const hive = await db.prepare('SELECT * FROM hives WHERE id = ?').get(normalizedHiveId);
      if (!hive) return res.status(404).json({ success: false, message: 'Hive not found' });
    }

    if (normalizedApiaryId) {
      const apiary = await db.prepare('SELECT * FROM apiaries WHERE id = ?').get(normalizedApiaryId);
      if (!apiary) return res.status(404).json({ success: false, message: 'Apiary not found' });
    }

    const result = await db.prepare(`
      INSERT INTO expenses (
        user_id, hive_id, apiary_id, expense_date, expense_type,
        amount, description, receipt_image, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.userId,
      normalizedHiveId,
      normalizedApiaryId,
      expenseDate,
      expenseType,
      amount,
      description || null,
      receiptImage || null,
      notes || null
    );

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: { expense }, id: expense.id });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    const {
      expenseDate,
      expenseType,
      amount,
      description,
      receiptImage,
      notes,
    } = req.body;

    await db.prepare(`
      UPDATE expenses
      SET expense_date = ?, expense_type = ?, amount = ?, description = ?,
          receipt_image = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      expenseDate || existing.expense_date,
      expenseType || existing.expense_type,
      amount !== undefined ? amount : existing.amount,
      description !== undefined ? description : existing.description,
      receiptImage !== undefined ? receiptImage : existing.receipt_image,
      notes !== undefined ? notes : existing.notes,
      req.params.id
    );

    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    res.json({ success: true, data: { expense } });
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    await db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

export default router;
