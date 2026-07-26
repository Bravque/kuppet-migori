-- Migration #25 — schools reference table (autocomplete source)
-- A curated list of schools that powers the school-name autocomplete on member
-- registration, member profile, and the admin school filters — so the same school
-- is spelled one consistent way instead of many typed variants.
-- Seeded from the distinct school names members have already entered; admins then
-- curate the list (merge duplicates/typos, add missing schools) on the Schools page.

CREATE TABLE IF NOT EXISTS schools (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(200) NOT NULL,
  sub_county VARCHAR(100) NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_school_name (name)
);

-- Seed from existing member entries (skips blanks; UNIQUE + INSERT IGNORE de-dupes).
INSERT IGNORE INTO schools (name)
SELECT DISTINCT TRIM(school_name)
FROM members
WHERE school_name IS NOT NULL AND TRIM(school_name) <> '';
