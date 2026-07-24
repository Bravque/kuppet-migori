-- Migration #20 — email_templates table
-- Reusable email templates (name + subject + body), the email counterpart to
-- sms_templates. Editable from the admin Email Templates page; picked in the
-- Send Email composer to fill subject + message.

CREATE TABLE IF NOT EXISTS email_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  category ENUM('bbf','scholarship','general','system') DEFAULT 'general',
  created_by INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
