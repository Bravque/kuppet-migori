-- Migration #26 — scholarship_application_timeline (audit trail)
-- Mirrors bbf_claim_timeline: one row per status change on a scholarship
-- application (submitted → under_review → approved/rejected → paid), so the
-- application has the same who/when/what history a BBF claim has.

CREATE TABLE IF NOT EXISTS scholarship_application_timeline (
  id INT PRIMARY KEY AUTO_INCREMENT,
  application_id INT NOT NULL,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  comment TEXT,
  changed_by INT NOT NULL,
  changed_by_type ENUM('admin','member') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
