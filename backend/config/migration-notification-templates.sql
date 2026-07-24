-- Migration #22 — notification_templates table
-- Admin-editable overrides for the BBF-claim and scholarship-application status
-- notifications (title + message + SMS text) defined in
-- notificationService.NOTIFICATION_TEMPLATES. One row per event_key; absence of
-- a row = use the hardcoded default. Fields may contain {{placeholders}} and
-- {{#var}}…{{/var}} / {{^var}}…{{/var}} sections.

CREATE TABLE IF NOT EXISTS notification_templates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  template_key VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  sms VARCHAR(1000) NOT NULL,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
