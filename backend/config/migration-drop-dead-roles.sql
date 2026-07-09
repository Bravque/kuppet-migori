-- Migration: prune the unused 'editor' and 'viewer' admin roles.
-- These were in the users.role ENUM but no route ever granted them access
-- (authorizeAdmin only accepts super_admin/branch_officer), so any such
-- account was login-capable but useless. Run once on the live Hostinger DB.
-- Idempotent. Fresh installs already exclude them via init*.sql.

-- Safety check — inspect before running the reassignment:
--   SELECT role, COUNT(*) FROM users GROUP BY role;

-- Reassign any existing editor/viewer accounts to branch_officer, then
-- contract the ENUM to the two live roles.
UPDATE users SET role = 'branch_officer' WHERE role IN ('editor', 'viewer');
ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin','branch_officer') NOT NULL DEFAULT 'branch_officer';
