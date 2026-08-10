-- Migration #28 — add 'bbf_claim_form' to BBF doc_type ENUM
-- Death claims now require a "BBF Claim Form" in place of the old
-- "Letter From Principal" slot (TSC Slip + Burial Permit + BBF Claim Form,
-- plus optional Birth Notification). 'letter_from_principal' is kept in the
-- ENUM so documents on existing death claims still render with their label.
--
-- ⚠ Run this on the live DB BEFORE deploying the code that uses the new slot,
--    or BBF Claim Form uploads will fail (the ENUM would reject the value).

ALTER TABLE bbf_claim_documents
  MODIFY COLUMN doc_type
    ENUM('tsc_slip','burial_permit','birth_notification','letter_from_principal','bbf_claim_form','letter_of_compulsory_retirement','other')
    NOT NULL;
