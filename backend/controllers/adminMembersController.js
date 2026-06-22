const db = require('../config/database');
const { sendXlsx } = require('../utils/excel');
const notificationService = require('../services/notificationService');
const mailerService = require('../services/mailerService');

async function getAll(req, res) {
  try {
    const { status, sub_county, search, limit = 25, offset = 0 } = req.query;
    let query = `SELECT id, member_number, full_name, tsc_number, phone, email, gender,
                        school_name, sub_county, status, created_at, approved_at
                 FROM members WHERE 1=1`;
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (sub_county) { query += ' AND sub_county = ?'; params.push(sub_county); }
    if (search) { query += ' AND (full_name LIKE ? OR tsc_number LIKE ? OR email LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(query, params);
    const [[{ total }]] = await db.query(
      'SELECT COUNT(*) as total FROM members WHERE 1=1' +
      (status ? ' AND status = ?' : '') +
      (search ? ' AND (full_name LIKE ? OR tsc_number LIKE ?)' : ''),
      [...(status ? [status] : []), ...(search ? [`%${search}%`, `%${search}%`] : [])]
    );
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch members' });
  }
}

async function getOne(req, res) {
  try {
    const [[member]] = await db.query(
      `SELECT id, member_number, full_name, tsc_number, national_id, employment_number,
              phone, email, gender, date_of_birth, school_name, sub_county, school_category,
              passport_photo_url, national_id_url, status, rejection_reason,
              approved_by, approved_at, last_login, created_at
       FROM members WHERE id = ?`,
      [req.params.id]
    );
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: member });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch member' });
  }
}

async function approve(req, res) {
  try {
    const [[member]] = await db.query('SELECT id, full_name, email, member_number, status FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    if (member.status === 'approved') return res.status(400).json({ success: false, message: 'Already approved' });

    await db.query(
      'UPDATE members SET status = "approved", approved_by = ?, approved_at = NOW() WHERE id = ?',
      [req.user.id, member.id]
    );

    await notificationService.createNotification({
      memberId: member.id,
      type: 'general',
      title: 'Membership Approved',
      body: `Congratulations! Your KUPPET Migori membership has been approved. Member No: ${member.member_number}`,
      adminId: req.user.id,
      smsMessage: `Dear ${member.full_name.split(' ')[0]}, your KUPPET Migori membership has been APPROVED. Member No: ${member.member_number}. Login at kuppetmigori.co.ke/member/login.html - KUPPET Migori`,
    });

    const { subject, html } = mailerService.templates.memberApproved(member.full_name, member.member_number);
    mailerService.sendMail({ to: member.email, subject, html }).catch(() => {});

    res.json({ success: true, message: 'Member approved' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve' });
  }
}

async function reject(req, res) {
  try {
    const { reason } = req.body;
    const [[member]] = await db.query('SELECT id, full_name, email FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });

    await db.query(
      'UPDATE members SET status = "rejected", rejection_reason = ? WHERE id = ?',
      [reason || null, member.id]
    );

    const { subject, html } = mailerService.templates.memberRejected(member.full_name, reason || 'Not specified');
    mailerService.sendMail({ to: member.email, subject, html }).catch(() => {});

    res.json({ success: true, message: 'Member rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reject' });
  }
}

async function suspend(req, res) {
  try {
    const [[member]] = await db.query('SELECT id FROM members WHERE id = ?', [req.params.id]);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found' });
    await db.query('UPDATE members SET status = "suspended" WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Member suspended' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to suspend' });
  }
}

async function remove(req, res) {
  try {
    await db.query('DELETE FROM members WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
}

async function exportExcel(req, res) {
  try {
    const [rows] = await db.query(
      `SELECT member_number, full_name, tsc_number, phone, email, gender, school_name,
              sub_county, school_category, status, DATE(created_at) as registered
       FROM members ORDER BY created_at DESC`
    );
    await sendXlsx(res, { sheetName: 'Members', filename: 'kuppet-members.xlsx', rows });
  } catch (err) {
    console.error('Members export failed:', err);
    res.status(500).json({ success: false, message: 'Export failed' });
  }
}

module.exports = { getAll, getOne, approve, reject, suspend, remove, exportExcel };
