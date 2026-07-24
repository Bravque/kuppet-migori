-- Migration #21 — transactional_templates table
-- Admin-editable overrides for the automated system emails (registration
-- received, membership approved/rejected, password reset, contact
-- acknowledgement). One row per template_key; absence of a row = use the
-- hardcoded default in mailerService.js. Subject + body may contain
-- {{placeholders}}.

CREATE TABLE IF NOT EXISTS transactional_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(64) NOT NULL UNIQUE,
  subject VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
