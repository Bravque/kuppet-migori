-- Migration #14: add TSC job group to members personal details.
-- Adds members.job_group (TSC grade scale B5, C1-C5, D1-D5), nullable so
-- existing/imported members are unaffected until they set it in their profile.
-- Required at NEW registration (enforced in the app + onboarding), not backfilled here.
-- Run once on the live Hostinger DB (phpMyAdmin -> SQL). Idempotent-ish: guarded by IF NOT EXISTS.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS job_group
    ENUM('B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5')
    NULL AFTER school_category;
