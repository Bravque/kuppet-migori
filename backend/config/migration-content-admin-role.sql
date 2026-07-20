-- Migration #15: add the content-only admin role.
-- content_admin can manage only the website Content section (news, events,
-- resources, leadership, scholarship listings, advocacy, ticker announcements)
-- + their own Account Security. It is blocked from members, welfare, legal,
-- communications, contacts and administration (enforced in auth.js — it is NOT
-- in ADMIN_ROLES, and content routes use authorizeContent).
-- Run once on the live Hostinger DB (phpMyAdmin -> SQL).

ALTER TABLE users
  MODIFY COLUMN role
    ENUM('super_admin','branch_officer','branch_secretary','content_admin')
    NOT NULL DEFAULT 'branch_officer';
