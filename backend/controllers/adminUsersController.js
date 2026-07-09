const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function getAll(req, res) {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, is_active, last_login, created_at FROM users ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
}

async function create(req, res) {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    const validRoles = ['super_admin', 'branch_officer', 'branch_secretary'];
    if (role && !validRoles.includes(role)) return res.status(400).json({ success: false, message: 'Invalid role' });

    const [[existing]] = await db.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email.toLowerCase(), hash, role || 'branch_officer']
    );
    const [[user]] = await db.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create user' });
  }
}

async function update(req, res) {
  try {
    const { name, role, is_active } = req.body;
    // Prevent self-demotion
    if (req.params.id == req.user.id && role && role !== req.user.role) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    const fields = [], params = [];
    if (name !== undefined)      { fields.push('name = ?'); params.push(name); }
    if (role !== undefined)      { fields.push('role = ?'); params.push(role); }
    if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.params.id);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'User updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update user' });
  }
}

async function remove(req, res) {
  try {
    if (req.params.id == req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete user' });
  }
}

module.exports = { getAll, create, update, remove };
