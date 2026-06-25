-- ============================================================
-- Migration: Contact reply tracking
-- Date: 2026-06-26
-- Purpose:
--   * Store the admin's reply text + timestamp on each enquiry, so the
--     Contact Inbox "Reply" action (emails the enquirer) keeps a record.
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include these via init.sql / init-hostinger.sql.
-- ============================================================

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS admin_reply TEXT          NULL AFTER status,
  ADD COLUMN IF NOT EXISTS replied_at  TIMESTAMP     NULL AFTER admin_reply;
