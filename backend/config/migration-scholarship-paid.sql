-- Migration #24 — scholarship "mark as paid"
-- Adds a paid stage + payment particulars to scholarship_applications, mirroring
-- the BBF claim paid flow. Approved applications can be marked paid by an admin.

ALTER TABLE scholarship_applications
  MODIFY COLUMN status ENUM('applied','under_review','approved','rejected','paid') DEFAULT 'applied';

ALTER TABLE scholarship_applications
  ADD COLUMN payment_reference VARCHAR(100) NULL AFTER amount_awarded,
  ADD COLUMN payment_date DATE NULL AFTER payment_reference;
