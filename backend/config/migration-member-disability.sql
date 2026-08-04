-- Migration #27 — Person With Disability (PWD) fields on members
-- Adds a boolean flag + free-text description. Description is only meaningful
-- when has_disability = 1 (enforced at the API layer, not the schema).
-- Both nullable/defaulted so existing rows and bulk imports are unaffected.
ALTER TABLE members
  ADD COLUMN has_disability TINYINT(1) NOT NULL DEFAULT 0 AFTER job_group,
  ADD COLUMN disability_description TEXT NULL AFTER has_disability;
