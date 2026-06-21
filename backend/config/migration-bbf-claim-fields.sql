-- ============================================================
-- Migration: BBF claim restructure (run ONCE on existing DBs)
-- Date: 2026-06-21
-- Purpose:
--   * Reduce claim types to two: 'death', 'retirement'
--   * Add claim particulars: name, TSC no, sub-county, school,
--     school category, relationship, date of death
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include these via init.sql / init-hostinger.sql.
-- ============================================================

-- 1. Add the new claim-particular columns
ALTER TABLE bbf_claims
  ADD COLUMN deceased_name   VARCHAR(200)                               AFTER claim_type,
  ADD COLUMN tsc_no          VARCHAR(50)                                AFTER deceased_name,
  ADD COLUMN sub_county      VARCHAR(100)                               AFTER tsc_no,
  ADD COLUMN school          VARCHAR(200)                               AFTER sub_county,
  ADD COLUMN school_category ENUM('senior_school','junior_school')     AFTER school,
  ADD COLUMN relationship    VARCHAR(100)                               AFTER school_category,
  ADD COLUMN date_of_death   DATE                                       AFTER relationship;

-- 2. Migrate the claim_type ENUM from the old four values to the new two.
--    Temporarily widen the ENUM so existing rows remain valid, remap, then narrow.
ALTER TABLE bbf_claims
  MODIFY claim_type ENUM('death_benefit','disability','medical_emergency','other','death','retirement') NOT NULL;

UPDATE bbf_claims
  SET claim_type = 'death'
  WHERE claim_type IN ('death_benefit','disability','medical_emergency','other');

ALTER TABLE bbf_claims
  MODIFY claim_type ENUM('death','retirement') NOT NULL;

-- 3. School category now lives on the member profile (captured at registration),
--    so the member never re-enters it on a claim. Nullable for existing members;
--    new registrations are required to set it.
ALTER TABLE members
  ADD COLUMN school_category ENUM('senior_school','junior_school') AFTER sub_county;

-- 4. Scholarship types reduced to three: KCSE, KJSEA, DTE (Diploma in Technical Education).
--    Widen, remap old values to the closest new value, then narrow.
ALTER TABLE scholarships
  MODIFY scholarship_type ENUM('undergraduate','postgraduate','vocational','research','international','kcse','kjsea','dte') DEFAULT 'kcse';

UPDATE scholarships SET scholarship_type = 'dte'  WHERE scholarship_type = 'vocational';
UPDATE scholarships SET scholarship_type = 'kcse' WHERE scholarship_type IN ('undergraduate','postgraduate','research','international');

ALTER TABLE scholarships
  MODIFY scholarship_type ENUM('kcse','kjsea','dte') DEFAULT 'kcse';
