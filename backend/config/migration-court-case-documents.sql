-- ============================================================
-- Migration: Court case document attachments
-- Date: 2026-07-03
-- Purpose:
--   * Add court_case_documents so branch officers can attach files
--     (pleadings, rulings, correspondence) to a court case. Files are
--     access-controlled (served only via /api/admin/documents/:filename).
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include this via init.sql / init-hostinger.sql.
-- Run migration-court-cases.sql first (it creates court_cases).
-- ============================================================

CREATE TABLE IF NOT EXISTS court_case_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  label VARCHAR(200),
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_case_docs_case (case_id)
);
