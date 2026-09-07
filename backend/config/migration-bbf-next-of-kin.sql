-- Migration #29 — Deceased-member BBF claims (admin-filed) + next of kin
--
-- Supports the case where the MEMBER themselves has died: an admin files the
-- death-benefit claim on their behalf, records a next-of-kin (the claimant), and
-- all claim notifications (SMS/email) are routed to that next of kin instead of
-- the deceased member's own contacts.
--
-- On bbf_claims:
--   deceased_is_member      1 when the deceased is the member (vs. a relative).
--   next_of_kin_*           the claimant contact; notifications go here when
--                           deceased_is_member = 1.
--   filed_by                the admin (users.id) who filed the claim; NULL for
--                           the normal member-filed claims.
-- On members:
--   is_deceased             flags the account closed — login is blocked and the
--                           member is excluded from active-member workflows.
--
-- All columns nullable/defaulted so existing rows and bulk imports are
-- unaffected. Idempotent (IF NOT EXISTS) so it is safe to re-run.

ALTER TABLE bbf_claims
  ADD COLUMN IF NOT EXISTS deceased_is_member TINYINT(1) NOT NULL DEFAULT 0 AFTER claim_type,
  ADD COLUMN IF NOT EXISTS next_of_kin_name VARCHAR(200) NULL AFTER date_of_death,
  ADD COLUMN IF NOT EXISTS next_of_kin_relationship VARCHAR(100) NULL AFTER next_of_kin_name,
  ADD COLUMN IF NOT EXISTS next_of_kin_phone VARCHAR(30) NULL AFTER next_of_kin_relationship,
  ADD COLUMN IF NOT EXISTS next_of_kin_email VARCHAR(255) NULL AFTER next_of_kin_phone,
  ADD COLUMN IF NOT EXISTS filed_by INT NULL AFTER next_of_kin_email;

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS is_deceased TINYINT(1) NOT NULL DEFAULT 0 AFTER status;
