const db = require('../config/database');
const { REQUIRED_PROFILE_FIELDS, missingProfileFields } = require('../utils/memberProfile');
const { resolveSchool, OFF_LIST_MESSAGE } = require('../utils/schools');

// Members may complete/correct these themselves (email/gender/DOB are needed for
// first-login onboarding of imported members). Everything else is admin-only.
const ALLOWED_FIELDS = ['phone','school_name','sub_county','employment_number','school_category','job_group','email','gender','date_of_birth'];
const JOB_GROUPS = ['B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'];

// The editable fields that are also required for a complete profile — derived so
// it stays in sync if either list changes. These may be filled in or corrected,
// never cleared (see updateProfile). `employment_number` is the only editable
// field not in here, so it remains clearable.
const REQUIRED_EDITABLE = new Set(ALLOWED_FIELDS.filter(f => REQUIRED_PROFILE_FIELDS.includes(f)));

const FIELD_LABELS = {
  phone: 'Phone number', email: 'Email', gender: 'Gender', date_of_birth: 'Date of birth',
  school_name: 'School name', sub_county: 'Sub-county', school_category: 'Category',
  job_group: 'Job group', employment_number: 'Employment number',
};

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

async function getProfile(req, res) {
  try {
    const [[m]] = await db.query(
      `SELECT id, member_number, full_name, tsc_number, national_id, employment_number,
              phone, email, gender, date_of_birth, school_name, sub_county, school_category, job_group,
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
    // Current values — needed to tell "leave this blank field alone" from
    // "clear a field that has a value", and to recompute completeness after.
    const [[current]] = await db.query(
      `SELECT full_name, tsc_number, national_id, phone, email, gender, date_of_birth,
              school_name, sub_county, school_category, job_group, onboarding_complete
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    if (!current) return res.status(404).json({ success: false, message: 'Member not found' });

    const fields = [], params = [];
    for (const key of ALLOWED_FIELDS) {
      if (req.body[key] === undefined) continue;
      let value = req.body[key];

      // A required field may be filled in or corrected but never cleared —
      // otherwise a member could blank out their phone/gender/job group and
      // still count as onboarded (the completeness flag only ever moves 0 → 1).
      // A blank submitted for a field that is *already* blank is left untouched,
      // so partial saves during first-login onboarding keep working.
      if (isBlank(value) && REQUIRED_EDITABLE.has(key)) {
        if (!isBlank(current[key])) {
          return res.status(400).json({ success: false, message: `${FIELD_LABELS[key]} is required and cannot be cleared` });
        }
        continue;
      }

      if (key === 'school_category' && value && !['senior_school','junior_school','tertiary_school'].includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid school category' });
      }
      if (key === 'job_group' && value && !JOB_GROUPS.includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid job group' });
      }
      if (key === 'gender' && value && !['male','female','other'].includes(value)) {
        return res.status(400).json({ success: false, message: 'Invalid gender' });
      }
      if (key === 'school_name' && value) {
        // Curated schools list is the source of truth — must be on it (canonical spelling stored).
        const school = await resolveSchool(value);
        if (!school.ok) return res.status(400).json({ success: false, message: OFF_LIST_MESSAGE });
        value = school.name;
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
      fields.push(`${key} = ?`); params.push(isBlank(value) ? null : value);
    }
    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update' });
    params.push(req.member.id);
    await db.query(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, params);

    const [[m]] = await db.query(
      `SELECT full_name, tsc_number, national_id, phone, email, gender, date_of_birth,
              school_name, sub_county, school_category, job_group, onboarding_complete
       FROM members WHERE id = ?`,
      [req.member.id]
    );
    const missing = missingProfileFields(m);

    // If this member was still onboarding and their profile is now complete,
    // flip the flag so the first-login gate lets them into the portal. This is
    // deliberately one-way: legacy members predating a required field (e.g.
    // job_group) are already flagged complete, and un-flagging them would lock
    // them back into onboarding.
    const justOnboarded = !m.onboarding_complete && missing.length === 0;
    if (justOnboarded) {
      await db.query('UPDATE members SET onboarding_complete = 1 WHERE id = ?', [req.member.id]);
    }
    res.json({
      success: true,
      message: 'Profile updated',
      profile_complete: missing.length === 0,
      // Current stored state …
      onboarding_complete: justOnboarded || !!m.onboarding_complete,
      // … versus "onboarding finished on *this* save". Callers wanting to
      // celebrate/redirect must use this one — onboarding_complete is true for
      // every already-onboarded member, i.e. on every ordinary profile edit.
      just_onboarded: justOnboarded,
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
