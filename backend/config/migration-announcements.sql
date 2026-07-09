-- Migration: homepage announcement ticker (editable from the admin portal)
-- Run once on the live Hostinger DB. Idempotent (IF NOT EXISTS / INSERT IGNORE).
-- Fresh installs get this via init.sql / init-hostinger.sql.

CREATE TABLE IF NOT EXISTS announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  text VARCHAR(500) NOT NULL,
  link VARCHAR(500) NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_announcements_active (is_active, sort_order)
);

-- Seed with the previously hardcoded ticker items so the homepage looks unchanged.
INSERT IGNORE INTO announcements (id, text, link, sort_order, is_active) VALUES
(1, 'AGM 2026 scheduled for July 20 – All members must attend', NULL, 1, 1),
(2, 'New TSC transfer guidelines effective June 2026', '/pages/news.html', 2, 1),
(3, 'KUPPET National Scholarship applications open until July 31', NULL, 3, 1),
(4, 'Teacher Wellness Program launching – Free medical check-ups available', NULL, 4, 1),
(5, 'BBF Claim forms updated – Visit branch office for new forms', NULL, 5, 1);
