-- Migration: bulk member import support
-- Run once on the live Hostinger DB (phpMyAdmin → SQL) BEFORE importing members.
--
-- 1. Relaxes NOT NULL on the columns that may be blank in an import sheet so
--    members can fill them in on first login. `email` stays UNIQUE — MySQL's
--    UNIQUE index permits multiple NULLs, so a nullable email is safe.
-- 2. Adds the two onboarding flags used by the forced first-login flow:
--      must_change_password : 1 = the member is still on the import default
--                             password (their national ID) and must set a new one.
--      onboarding_complete  : 0 = the member has not yet completed the required
--                             profile fields. Existing members default to 1 so
--                             they are never forced through onboarding.
--
-- full_name, tsc_number and national_id remain NOT NULL — every import row must
-- have them (tsc_number = login identifier, national_id = default password).

ALTER TABLE members
  MODIFY phone         VARCHAR(30)  NULL,
  MODIFY email         VARCHAR(255) NULL,
  MODIFY gender        ENUM('male','female','other') NULL,
  MODIFY date_of_birth DATE         NULL,
  MODIFY school_name   VARCHAR(300) NULL,
  MODIFY sub_county    VARCHAR(150) NULL;

ALTER TABLE members
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password,
  ADD COLUMN onboarding_complete  TINYINT(1) NOT NULL DEFAULT 1 AFTER must_change_password;
