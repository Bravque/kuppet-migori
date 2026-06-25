-- ============================================================
-- Migration: News media + Sport & Entertainment category
-- Date: 2026-06-26
-- Purpose:
--   * Add 'sport_entertainment' to the news.category ENUM
--   * Add a second image (image_2) and a downloadable document
--     (document_url + original document_name) to every article
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include these via init.sql / init-hostinger.sql.
-- ============================================================

-- 1. Add the new category to the ENUM (keeps all existing values)
ALTER TABLE news
  MODIFY category ENUM('news','announcement','circular','press_release','event','sport_entertainment') DEFAULT 'news';

-- 2. Add the media columns (IF NOT EXISTS — safe to re-run)
ALTER TABLE news
  ADD COLUMN IF NOT EXISTS image_2       VARCHAR(500) NULL AFTER featured_image,
  ADD COLUMN IF NOT EXISTS document_url  VARCHAR(500) NULL AFTER image_2,
  ADD COLUMN IF NOT EXISTS document_name VARCHAR(255) NULL AFTER document_url;
