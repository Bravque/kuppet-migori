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

-- Backfill each school's sub-county from the members recorded at that school.
-- MAX() keeps it compatible with every MySQL/MariaDB version; for the rare school
-- whose members span more than one sub-county it just picks one deterministically.
-- Only fills blanks, so admin-set sub-counties are never overwritten.
UPDATE schools s
JOIN (
  SELECT TRIM(school_name) AS name, MAX(sub_county) AS sub_county
  FROM members
  WHERE school_name IS NOT NULL AND TRIM(school_name) <> ''
    AND sub_county IS NOT NULL AND sub_county <> ''
  GROUP BY TRIM(school_name)
) m ON m.name = s.name
SET s.sub_county = m.sub_county
WHERE s.sub_county IS NULL OR s.sub_county = '';
