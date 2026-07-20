-- Migration #17 — prevent duplicate scholarship applications (one per member per scholarship)
-- The application create path checked for an existing row then inserted (read-then-write),
-- which races under concurrent/double-click submissions. This adds a DB-level UNIQUE guard
-- so the database rejects the duplicate; the controller catches ER_DUP_ENTRY → 409.
--
-- Run once on live (phpMyAdmin → SQL). Idempotent-ish: the dedup step is safe to re-run,
-- and ADD UNIQUE will error only if the key already exists (ignore that error on re-run).

-- 1) Remove any pre-existing duplicates, keeping the earliest application (lowest id).
DELETE sa FROM scholarship_applications sa
JOIN scholarship_applications keep
  ON keep.member_id = sa.member_id
 AND keep.scholarship_id = sa.scholarship_id
 AND keep.id < sa.id;

-- 2) Enforce one application per member per scholarship.
ALTER TABLE scholarship_applications
  ADD UNIQUE KEY uq_member_scholarship (member_id, scholarship_id);
