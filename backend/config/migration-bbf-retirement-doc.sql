-- Migration #19 — add 'letter_of_compulsory_retirement' to BBF doc_type ENUM
-- Retirement claims require TSC Slip + Letter of Compulsory Retirement
-- (instead of the death-claim burial_permit / letter_from_principal set).

ALTER TABLE bbf_claim_documents
  MODIFY COLUMN doc_type
    ENUM('tsc_slip','burial_permit','birth_notification','letter_from_principal','letter_of_compulsory_retirement','other')
    NOT NULL;
