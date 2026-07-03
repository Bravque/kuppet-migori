-- ============================================================
-- Migration: Scholarship application required document types
-- Date: 2026-07-03
-- Purpose:
--   * Add 'letter_of_application' and 'tsc_slip' to the
--     scholarship_application_documents.doc_type ENUM. These are the two
--     mandatory attachments a member now uploads when applying (applicant
--     identity is taken from their account). Legacy values are kept so any
--     existing rows remain valid.
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include this via init.sql / init-hostinger.sql.
-- ============================================================

ALTER TABLE scholarship_application_documents
  MODIFY COLUMN doc_type ENUM('letter_of_application','tsc_slip','kcse_cert','admission_letter','fee_structure','recommendation','other') NOT NULL;
