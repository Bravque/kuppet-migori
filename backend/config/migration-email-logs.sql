-- Migration #16: email delivery log for progress tracking.
-- Mirrors sms_logs so bulk/group email sends (which are backgrounded) have a
-- visible history + status in the admin Email Logs page. Statuses: sent |
-- failed | skipped (skipped = SMTP unconfigured). No DLR/delivered state — SMTP
-- has no delivery webhook like TalkSasa.
-- Run once on the live Hostinger DB (phpMyAdmin -> SQL) before deploying the
-- Email Logs page (the getLogs endpoint SELECTs this table).

CREATE TABLE IF NOT EXISTS email_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  recipient_email VARCHAR(254) NOT NULL,
  recipient_name VARCHAR(200),
  member_id INT,
  subject VARCHAR(255) NOT NULL,
  message TEXT,
  message_type ENUM('individual','bulk','group') DEFAULT 'individual',
  status ENUM('sent','failed','skipped') DEFAULT 'sent',
  error_message TEXT,
  sent_by INT NOT NULL,
  sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_email_logs_status (status),
  INDEX idx_email_logs_created (created_at)
);
