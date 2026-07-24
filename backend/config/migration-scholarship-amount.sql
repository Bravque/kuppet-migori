-- Migration #23 — scholarship award amount
-- Lets an admin record the amount awarded when approving a scholarship
-- application (mirrors bbf_claims.amount_approved).

ALTER TABLE scholarship_applications
  ADD COLUMN amount_awarded DECIMAL(12,2) NULL AFTER status;
