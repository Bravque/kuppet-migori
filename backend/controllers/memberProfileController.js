const db = require('../config/database');

async function getProfile(req, res) {
  try {
    const [[m]] = await db.query(
      `SELECT id, member_number, full_name, tsc_number, national_id, employment_number,
              phone, email, gender, date_of_birth, school_name, sub_county, school_category,
              passport_photo_url, status, created_at, approved_at
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' });
    res.json({ success: true, data: m });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

async function updateProfile(req, res) {
  try {
    const allowed = ['phone','school_name','sub_county','employment_number','school_category'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        if (key === 'school_category' && !['senior_school','junior_school'].includes(req.body[key])) {
          return res.status(400).json({ success: false, message: 'Invalid school category' });
        }
        fields.push(`${key} = ?`); params.push(req.body[key]);
      }
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.member.id);
    await db.query(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
}

async function uploadPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = `/uploads/members/${req.file.filename}`;
    await db.query('UPDATE members SET passport_photo_url = ? WHERE id = ?', [url, req.member.id]);
    res.json({ success: true, data: { url } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
}

module.exports = { getProfile, updateProfile, uploadPhoto };
