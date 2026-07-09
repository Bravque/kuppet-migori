-- Migration: add the 'branch_secretary' admin role.
-- It is a peer of branch_officer (identical access via authorizeAdmin: review/
-- recommend + content management; blocked from every authorizeSuperAdmin route).
-- Run once on the live Hostinger DB. Idempotent.
--
-- Self-contained: also reassigns any leftover legacy editor/viewer accounts to
-- branch_officer, so this works whether or not migration-drop-dead-roles.sql
-- has already been applied (it supersedes that migration).

UPDATE users SET role = 'branch_officer' WHERE role IN ('editor', 'viewer');
ALTER TABLE users
  MODIFY COLUMN role ENUM('super_admin','branch_officer','branch_secretary') NOT NULL DEFAULT 'branch_officer';
