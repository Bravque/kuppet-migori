// Fields a member must have filled in for their profile to count as "complete".
// Bulk-imported members start with only full_name / tsc_number / national_id /
// school_name / sub_county and must fill the rest during forced first-login
// onboarding (see must_change_password / onboarding_complete on `members`).
const REQUIRED_PROFILE_FIELDS = [
  'full_name', 'tsc_number', 'national_id',
  'phone', 'email', 'gender', 'date_of_birth',
  'school_name', 'sub_county', 'school_category', 'job_group',
];

function missingProfileFields(member) {
  return REQUIRED_PROFILE_FIELDS.filter((f) => {
    const v = member[f];
    return v === null || v === undefined || String(v).trim() === '';
  });
}

module.exports = { REQUIRED_PROFILE_FIELDS, missingProfileFields };
