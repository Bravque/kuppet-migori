-- Migration #18 — add 'tertiary_school' to school_category ENUM
-- Adds a third teaching category (Tertiary School) alongside senior/junior.
-- Applies to both tables that carry school_category: members + bbf_claims.

ALTER TABLE members
  MODIFY COLUMN school_category ENUM('senior_school','junior_school','tertiary_school');

ALTER TABLE bbf_claims
  MODIFY COLUMN school_category ENUM('senior_school','junior_school','tertiary_school');
