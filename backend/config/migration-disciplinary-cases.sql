-- ============================================================
-- Migration: Disciplinary Cases tracker (Legal section)
-- Date: 2026-07-17
-- Purpose:
--   * Track teacher disciplinary matters (TSC/employer disciplinary process):
--     the teacher, the alleged offence, the disciplinary stage, outcome, key
--     dates, a dated updates log and document attachments. Shared branch-wide;
--     each case records the responsible officer. Modeled on court_cases.
--   * Access is restricted to branch_officer + super_admin (branch_secretary
--     excluded), enforced in backend/routes/disciplinaryCases.js.
-- Safe to run on the live Hostinger DB via phpMyAdmin -> SQL tab.
-- Fresh installs already include this via init.sql / init-hostinger.sql.
-- ============================================================

CREATE TABLE IF NOT EXISTS disciplinary_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_ref VARCHAR(100),                       -- internal reference (optional)
  teacher_name VARCHAR(200) NOT NULL,
  tsc_number VARCHAR(50),
  school VARCHAR(300),
  sub_county VARCHAR(150),
  offence_category ENUM('misconduct','absenteeism','exam_irregularity','financial',
                        'insubordination','negligence','criminal','other') DEFAULT 'misconduct',
  description TEXT,
  status ENUM('reported','query_issued','interdicted','hearing','determined','appealed','closed') DEFAULT 'reported',
  outcome ENUM('pending','warning','suspension','dismissal','reinstated','cleared','other') DEFAULT 'pending',
  reported_date DATE NULL,
  interdiction_date DATE NULL,
  hearing_date DATE NULL,
  resolved_date DATE NULL,
  officer_id INT NULL,                          -- responsible admin (users.id)
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_disc_cases_status (status),
  INDEX idx_disc_cases_hearing (hearing_date)
);

CREATE TABLE IF NOT EXISTS disciplinary_case_updates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  update_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_disc_updates_case (case_id)
);

CREATE TABLE IF NOT EXISTS disciplinary_case_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  label VARCHAR(200),
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  uploaded_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_disc_docs_case (case_id)
);
