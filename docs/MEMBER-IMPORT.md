# Bulk member import (roster → active members)

Import an Excel roster as **active** members whose **default password is their
national ID**. On first login each member is forced to (1) set a new password,
then (2) complete the profile fields missing from the sheet.

## Order of operations (important)

The app code reads two new columns (`must_change_password`, `onboarding_complete`).
**Run the migration on the live DB BEFORE deploying the code / importing**, or
member logins will error on the missing columns.

1. **Migration** — phpMyAdmin → SQL → run `backend/config/migration-member-import.sql`.
   Relaxes NOT NULL on the fill-later columns and adds the two onboarding flags.
2. **Deploy the app code** (the first-login + onboarding flow).
3. **Generate the import SQL** (below) and run it in phpMyAdmin.

## Generating the SQL

Look up the current member counter first: phpMyAdmin → `settings` table → the
`member_seq` row's `setting_value` (use `0` if this is the first import).

```bash
node backend/scripts/import-members.js "/path/to/roster.xlsx" \
  --start-seq <current member_seq> \
  --out members-import.sql
```

The script prints a summary (ready / skipped + reasons) to the terminal and
writes `members-import.sql`. Hashing ~5k rows takes a few minutes.

Column mapping (KUPPET "pk" roster):

| Sheet column   | DB field                          |
|----------------|-----------------------------------|
| Officer's Name | `full_name`                       |
| Payroll-Num    | `tsc_number` (login) + `employment_number` |
| ID-Number      | `national_id` + default password  |
| Station-Name   | `school_name`                     |
| Work-SubCounty | `sub_county`                      |
| Tel            | ignored (corrupted in source)     |

Missing everywhere → left blank, filled on first login: email, gender, date of
birth, school category, phone.

## Importing

phpMyAdmin → database → **Import** → choose `members-import.sql` → Go. It runs in
a transaction, uses `INSERT IGNORE` (rows whose TSC/ID/email already exist are
skipped), and advances `settings.member_seq`. If the file exceeds the phpMyAdmin
upload limit, gzip it (`gzip members-import.sql`) and import the `.sql.gz`.

## What members experience

1. Log in with **TSC number (Payroll-Num)** + **national ID** as password.
2. Redirected to **Set Your Password** (must differ from the ID).
3. Redirected to **Profile** with a banner listing missing fields; the portal
   stays locked to this page until all required fields are filled.
4. On completion they land on the dashboard normally.

## Re-running / corrections

Safe to re-run: `INSERT IGNORE` skips anyone already present (by TSC/ID/email).
To reset one member to the onboarding state, set `must_change_password=1`,
`onboarding_complete=0`, and their `password` back to a bcrypt hash of the ID.
