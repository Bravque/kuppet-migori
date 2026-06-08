const db = require('../config/database');

async function getAll(req, res) {
  try {
    const { limit = 30, offset = 0, unread } = req.query;
    let query = 'SELECT * FROM notifications WHERE member_id = ?';
    const params = [req.member.id];
    if (unread === 'true') { query += ' AND is_read = 0'; }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    const [[{ unreadCount }]] = await db.query(
      'SELECT COUNT(*) as unreadCount FROM notifications WHERE member_id = ? AND is_read = 0',
      [req.member.id]
    );
    res.json({ success: true, data: rows, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: err.message });
  }
}

async function markRead(req, res) {
  try {
    await db.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND member_id = ?',
      [req.params.id, req.member.id]
    );
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update', error: err.message });
  }
}

async function markAllRead(req, res) {
  try {
    await db.query('UPDATE notifications SET is_read = 1 WHERE member_id = ?', [req.member.id]);
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update', error: err.message });
  }
}

module.exports = { getAll, markRead, markAllRead };
