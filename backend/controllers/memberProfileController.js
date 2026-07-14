const db = require('../config/database');
const { missingProfileFields } = require('../utils/memberProfile');

async function getProfile(req, res) {
  try {
    const [[m]] = await db.query(
      `SELECT id, member_number, full_name, tsc_number, national_id, employment_number,
              phone, email, gender, date_of_birth, school_name, sub_county, school_category,
              passport_photo_url, status, created_at, approved_at,
              must_change_password, onboarding_complete
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    if (!m) return res.status(404).json({ success: false, message: 'Member not found' });
    const missing = missingProfileFields(m);
    res.json({
      success: true,
      data: {
        ...m,
        must_change_password: !!m.must_change_password,
        onboarding_complete: !!m.onboarding_complete,
        profile_complete: missing.length === 0,
        missing_fields: missing,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
}

async function updateProfile(req, res) {
  try {
    // Members may complete/correct these fields themselves (email/gender/DOB are
    // needed for first-login onboarding of imported members).
    const allowed = ['phone','school_name','sub_county','employment_number','school_category','email','gender','date_of_birth'];
    const fields = [], params = [];
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      let value = req.body[key];

      if (key === 'school_category' && value && !['senior_school','junior_school'].includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid school category' });
      }
      if (key === 'gender' && value && !['male','female','other'].includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid gender' });
      }
      if (key === 'date_of_birth' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return res.status(400).json({ success: false, message: 'Invalid date of birth' });
      }
      if (key === 'email' && value) {
        value = String(value).trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
          return res.status(400).json({ success: false, message: 'Invalid email address' });
        }
        const [[dupe]] = await db.query('SELECT id FROM members WHERE email = ? AND id <> ?', [value, req.member.id]);
        if (dupe) return res.status(409).json({ success: false, message: 'That email is already in use' });
      }
      fields.push(`${key} = ?`); params.push(value === '' ? null : value);
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.member.id);
    await db.query(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, params);

    // If this member was still onboarding and their profile is now complete,
    // flip the flag so the first-login gate lets them into the portal.
    const [[m]] = await db.query(
      `SELECT full_name, tsc_number, national_id, phone, email, gender, date_of_birth,
              school_name, sub_county, school_category, onboarding_complete
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    const missing = missingProfileFields(m);
    if (!m.onboarding_complete && missing.length === 0) {
      await db.query('UPDATE members SET onboarding_complete = 1 WHERE id = ?', [req.member.id]);
    }
    res.json({
      success: true,
      message: 'Profile updated',
      profile_complete: missing.length === 0,
      onboarding_complete: missing.length === 0 ? true : !!m.onboarding_complete,
      missing_fields: missing,
    });
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
