-- ============================================================
-- Migration: Sports & Entertainment resource category
-- Date: 2026-06-26
-- Purpose:
--   * Add 'sport_entertainment' to the resources.category ENUM
--     (keeps all existing values + the 'teaching_material' default)
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include this via init.sql / init-hostinger.sql.
-- ============================================================

ALTER TABLE resources
  MODIFY category ENUM('curriculum','circular','moe_document','tsc_resource','professional_dev','teaching_material','legal','policy','sport_entertainment') DEFAULT 'teaching_material';
