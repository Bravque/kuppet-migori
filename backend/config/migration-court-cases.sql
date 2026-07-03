-- ============================================================
-- Migration: Court Cases tracker (branch officers)
-- Date: 2026-07-03
-- Purpose:
--   * Add court_cases + court_case_updates so branch officers can track
--     the branch's court matters (parties, court, status, hearing dates)
--     with a dated per-case updates/hearings log. Shared branch-wide; each
--     case records the responsible officer.
-- Safe to run on the live Hostinger DB via phpMyAdmin → SQL tab.
-- Fresh installs already include this via init.sql / init-hostinger.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS court_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_number VARCHAR(100),                    -- official court reference, e.g. "ELRC 123 of 2026"
  title VARCHAR(300) NOT NULL,
  court VARCHAR(200),                          -- court / station
  case_type ENUM('employment','disciplinary','criminal','civil','constitutional','appeal','other') DEFAULT 'employment',
  plaintiff VARCHAR(300),                      -- claimant / petitioner
  defendant VARCHAR(300),                      -- respondent
  status ENUM('open','ongoing','on_hold','closed') DEFAULT 'open',
  outcome ENUM('pending','won','lost','settled','withdrawn','dismissed') DEFAULT 'pending',
  filing_date DATE NULL,
  next_hearing_date DATE NULL,
  description TEXT,
  officer_id INT NULL,                          -- responsible admin (users.id)
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_court_cases_status (status),
  INDEX idx_court_cases_hearing (next_hearing_date)
);

CREATE TABLE IF NOT EXISTS court_case_updates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  update_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_case_updates_case (case_id)
);
