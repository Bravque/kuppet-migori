# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env          # Fill in DB credentials + set JWT secrets
npm install                   # Install all dependencies
npm run init-db               # Create MySQL schema (32 tables) and seed data

# Development
npm run dev                   # Start with nodemon auto-reload (port 3000)
npm start                     # Production start

# Re-seed the database
mysql -u root -p < backend/config/init.sql
```

There are no tests or linting scripts configured yet.

---

## Project Status (as of 2 July 2026)

**GitHub repo:** https://github.com/Bravque/kuppet-migori  
**Owner:** Bravque (bravinowino008@gmail.com)  
**Live domain:** https://kuppetmigori.co.ke (Hostinger Business — auto-deploys from GitHub `main`) ✓ LIVE

### Hosting setup
- **Platform:** Hostinger Business shared hosting
- **Deployment:** GitHub auto-deploy (push to `main` → Hostinger rebuilds automatically)
- **Database:** MySQL on Hostinger — `u735599564_KuppetMigori44`, user `u735599564_Admin44Kuppet`
- **Schema:** imported via `backend/config/init-hostinger.sql` (no `CREATE DATABASE` line)
- **Env vars:** set in hPanel → Environment variables (imported from `env-kuppet.txt` on Desktop). **Must include `UPLOAD_DIR=/home/u735599564/uploads`** (see persistent-uploads note) and `CONTACT_EMAIL` (contact-form notifications). `ADVOCACY_EMAIL` (`advocacy@kuppetmigori.co.ke`, a working Hostinger mailbox) receives + sends advocacy-report replies.
- **SSH:** `ssh -p 65002 u735599564@92.113.28.102` — password set in hPanel → SSH Access (separate from hPanel login password). Interactive shell may be disabled (`/sbin/nologin`); if so use **SFTP** or **hPanel File Manager** instead. App lives in `~/nodejs/`, web root in `~/public_html/`; uploads in `~/uploads/` (outside both).
- **Persistent uploads:** runtime uploads live in `~/uploads/` (set via `UPLOAD_DIR`), **outside** the git-deployed `~/nodejs/` tree, so they survive redeploys. See the File uploads section.

### What is built and committed ✓

| Layer | Status |
|-------|--------|
| Express server + all REST API routes | ✓ Complete |
| MySQL schema (32 tables) + seed data | ✓ Complete |
| Homepage (`index.html`) | ✓ Complete |
| About Us page | ✓ Complete |
| Teachers Notice Board (news.html) | ✓ Complete |
| Teacher Resource Centre | ✓ Complete |
| Advocacy Desk | ✓ Complete |
| Scholarships page | ✓ Complete |
| Contact Us page | ✓ Complete |
| CSS design system — style.css | ✓ Complete |
| Portal CSS — portal.css (sidebar layout, status badges, tables) | ✓ Complete |
| Frontend JS — api.js + main.js | ✓ Complete |
| **Real KUPPET logo** — header, footer, portal sidebars (white bg) | ✓ Complete |
| **Henri Otunga photo** — `public/images/leaders/henri-otunga.jpg` | ✓ Complete |
| **Member registration (3-step form + doc uploads)** | ✓ Complete |
| **Member login (by TSC number) + JWT auth + account lockout + forgot/reset password** | ✓ Complete |
| **Member portal — dashboard, profile, BBF claims, scholarships, notifications, history** | ✓ Complete |
| **Admin login with optional TOTP 2FA** | ✓ Complete |
| **Admin portal — 26 pages (all CRUD/actions wired)** | ✓ Complete |
| **Court cases tracker (branch officers) — list, detail, updates log, dashboard summary** | ✓ Complete |
| **Disciplinary cases tracker (branch officers) — teacher discipline: list, detail, updates log, documents** | ✓ Complete (17 Jul 2026; ⚠ needs migration #13 on live) |
| **Admin member management — approve / reject / suspend** | ✓ Complete |
| **BBF claims workflow (draft→submitted→under_review→approved→rejected→paid)** | ✓ Complete |
| **Scholarship applications workflow (applied→under_review→approved→rejected)** | ✓ Complete |
| **Content CRUD — news, events, resources, leadership, scholarships, advocacy** | ✓ Complete |
| **SMS module — TalkSasa integration (individual, bulk, group, templates)** | ✓ Complete |
| **Notifications — in-app + SMS on claim/application status changes** | ✓ Complete |
| **Analytics dashboard with Chart.js + PDF/Excel exports** | ✓ Complete |
| **Audit logs — every mutation recorded with actor, action, IP** | ✓ Complete |
| **Admin user management (super_admin + branch_officer roles)** | ✓ Complete |
| **File uploads — multer with UUID filenames, type/size validation** | ✓ Complete |
| **Email notifications — nodemailer (registration, approval, rejection)** | ✓ Complete |
| **CSRF protection — double-submit cookie on all portal mutations** | ✓ Complete |

**Branch Chairman:** Kevin Odhiambo · **Executive Secretary:** Henry Otunga · **Treasurer:** May Abong'o  
(Full 14-official roster seeded in `init*.sql`; on the live DB run `backend/config/update-leadership.sql` once. About page groups them: 3 principal officials in their own row, then the rest. Phones stored E.164 and shown as click-to-call icons; no emails were in the source scan.)  
**Official contact details (used sitewide — single source):**
- Phone: +254 721 808 993
- Email: info@kuppetmigori.co.ke (the **only** email used across the site)
- Address: Cosade Building, 3rd Floor, Front Wing, P.O. Box 842-40400, Migori Town, Kenya
- WhatsApp channel (only social link sitewide): https://whatsapp.com/channel/0029VbCDNtx23n3d4LFqbe15

**Sub-counties (12, used sitewide — registration, profile, admin filters, contact page, org structure):**
Rongo, Awendo, Uriri, Suna East, Suna West, Ntimaru, Kuria West, Kuria East, Mabera, Nyatike South, Nyatike West, Nyatike North.
(Per-sub-county rep phone numbers are still placeholders — all reuse the main number.)

---

### Admin portal credentials

- **URL:** `https://kuppetmigori.co.ke/admin/login.html`
- **Email:** `admin@kuppetmigori.co.ke`
- **Password:** set via phpMyAdmin (see reset procedure below)
- **Role:** `super_admin`

**If locked out or password unknown — reset via phpMyAdmin (no default password is published):**
1. Generate a fresh bcrypt hash for a strong, secret password of your choosing:
   `node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 10))" 'YOUR-NEW-STRONG-PASSWORD'`
   (run locally; never commit the password or the resulting hash)
2. hPanel → Databases → phpMyAdmin → `u735599564_KuppetMigori44` → SQL tab
3. Run (paste your generated hash; `is_active = 1` activates the inactive seed account):
```sql
UPDATE users
SET password = '<paste-your-generated-bcrypt-hash>',
    is_active = 1,
    failed_login_attempts = 0,
    locked_until = NULL
WHERE email = 'admin@kuppetmigori.co.ke';
```
4. Log in, then enable TOTP 2FA on the account immediately. Never store the password in this repo.

> Account lockout triggers after repeated failed attempts — `locked_until` and `failed_login_attempts` columns on the `users` table. The app uses `bcryptjs` (not `bcrypt`).

---

### Session history

Dated development logs (2 July back to 17 June 2026) live in **`docs/SESSION-NOTES.md`** to keep this always-loaded file lean. Consult it for the narrative of what changed and why in each session. The durable state those sessions produced is reflected in the sections below (What is built, Architecture, Database schema, Remaining tasks).

### Remaining tasks (pick up here next session)

**Task 1 — Article detail pages** — ✓ DONE (21 June 2026).

**DB migrations — #1–26 all applied on live (last: #25 + #26 on 27 July 2026)**
Scripts #1–26 have been run on the live Hostinger DB and are folded into `init.sql` / `init-hostinger.sql` for fresh installs — their individual `backend/config/migration-*.sql` files are kept for re-provisioning reference (see `docs/SESSION-NOTES.md` for what each changed). Reference of the most recent:
13. `backend/config/migration-disciplinary-cases.sql` — `disciplinary_cases` + `disciplinary_case_updates` + `disciplinary_case_documents` (teacher disciplinary-matter tracker under Legal). ✓ Applied 20 July 2026. Needs `~/uploads/disciplinary` on live (app auto-creates at startup; ensure it exists for the persistent UPLOAD_DIR).
14. `backend/config/migration-member-job-group.sql` — adds `members.job_group` (TSC grade ENUM `B5`,`C1`–`C5`,`D1`–`D5`, nullable). ✓ Applied 20 July 2026. Required at new registration + part of first-login onboarding (`REQUIRED_PROFILE_FIELDS`); existing/imported members are null until they set it in their profile.
15. `backend/config/migration-content-admin-role.sql` — extends `users.role` ENUM with `content_admin`. ✓ Applied 20 July 2026.
16. `backend/config/migration-email-logs.sql` — `email_logs` table (email send history; status `sent`/`failed`/`skipped`, no DLR). ✓ Applied 20 July 2026. Required before the Email Logs page loads (`getLogs` SELECTs it).
17. `backend/config/migration-scholarship-app-unique.sql` — de-dupes then adds `UNIQUE KEY uq_member_scholarship (member_id, scholarship_id)` on `scholarship_applications` (one application per member per scholarship). ✓ Applied 20 July 2026. Closes the read-then-write duplicate race in `memberScholarshipController.apply` (which now catches `ER_DUP_ENTRY` on that key → 409). Paired code fix (no migration needed): `nextSeq` in `memberAuthController.js` now runs its `UPDATE`+`SELECT LAST_INSERT_ID()` on a single pooled connection — the read-back was connection-scoped and could return another request's value under concurrency, producing duplicate/wrong `MBR`/`BBF`/`SAPP` numbers.
18. `backend/config/migration-school-category-tertiary.sql` — adds `tertiary_school` to the `school_category` ENUM on **both** `members` and `bbf_claims` (third registration category). ✓ Applied 24 July 2026; folded into `init*.sql`.
19. `backend/config/migration-bbf-retirement-doc.sql` — adds `letter_of_compulsory_retirement` to the `bbf_claim_documents.doc_type` ENUM (retirement claims require TSC Slip + Letter of Compulsory Retirement). ✓ Applied 24 July 2026; folded into `init*.sql`.
20. `backend/config/migration-email-templates.sql` — creates the `email_templates` table (reusable email subject + body; the email counterpart to `sms_templates`). ✓ Applied 24 July 2026; folded into `init*.sql`. API at `GET/POST /api/admin/email/templates` + `PUT /api/admin/email/templates/:id` (all `authorizeAdmin`); page `email-templates.html`.
21. `backend/config/migration-transactional-templates.sql` — creates the `transactional_templates` table (admin overrides for the automated system emails). ✓ Applied 24 July 2026; folded into `init*.sql`. See the mailer section.
22. `backend/config/migration-notification-templates.sql` — creates the `notification_templates` table (admin overrides for the BBF/scholarship status notifications — title + body + sms). ✓ Applied 24 July 2026; folded into `init*.sql`. See the notifications section.
23. `backend/config/migration-scholarship-amount.sql` — adds `scholarship_applications.amount_awarded DECIMAL(12,2) NULL` (award amount set by admin on approval, mirrors `bbf_claims.amount_approved`). ✓ Applied 25 July 2026; folded into `init*.sql`. Without it, approving a scholarship 500s (the UPDATE sets `amount_awarded`).
24. `backend/config/migration-scholarship-paid.sql` — adds `paid` to `scholarship_applications.status` ENUM + `payment_reference VARCHAR(100)` + `payment_date DATE` (admin "mark as paid" flow, mirrors BBF). ✓ Applied 25 July 2026; folded into `init*.sql`. Without it, marking a scholarship paid 500s.
26. `backend/config/migration-scholarship-timeline.sql` — creates `scholarship_application_timeline` (mirrors `bbf_claim_timeline`) so scholarship applications have the same status-change audit trail as BBF claims. ✓ Applied 27 July 2026; folded into `init*.sql`. **Deploy-safe by design:** all timeline reads/writes are wrapped best-effort (try/catch) so a missing table can never break scholarship apply or the admin detail page — keep that guard for fresh installs that haven't run the migration yet. Paired with the new `PUT /api/admin/scholarship-apps/:id/review` (Start Review, applied→under_review, `authorizeAdmin`) + `scholarship_under_review` notification, so the scholarship flow now matches BBF (submitted→under_review→approved/rejected→paid, each logged + notified).
25. `backend/config/migration-schools.sql` — creates the `schools` table (`name` UNIQUE, `sub_county`, `is_active`) **and seeds it from the distinct `members.school_name` values already on record**, then backfills each school's `sub_county` from those members (only where blank, so admin-set values are never overwritten). ✓ Applied 27 July 2026. Note the CREATE is folded into `init*.sql` but the **seed + backfill steps only live in the migration** — a fresh install starts with an empty `schools` table, so run this migration (or curate the list on the Schools page) before enforcement means anything. Powers the school-name **autocomplete** on registration/profile/admin filters + the admin **Schools** page (`schools.html`). Public source at `GET /api/schools`; admin CRUD at `/api/admin/schools` (`schoolsController` + `routes/schools.js` public / `routes/adminSchools.js` admin). Members store `school_name` as free text (no FK), so editing/deleting a school only changes the suggestion list — existing members are untouched. **The curated list is the source of truth (26 July 2026):** member registration + profile-save now **reject a school that isn't on the active list** (via `backend/utils/schools.js` `resolveSchool`), storing the canonical spelling; off-list values get `OFF_LIST_MESSAGE` ("select from the list / contact the office"). `register.html` mirrors this client-side (`KNOWN_SCHOOLS` set, checked in `validateStep`). ⚠ **Empty-list guard (still active):** if `schools` is empty or missing, enforcement is skipped so it can never block all registrations. Now that the table is seeded on live, enforcement **is** in effect — the corollary is that emptying/deactivating the whole list silently turns off validation rather than rejecting everything.

**Task 3 — Real content (owner must supply)**
Still placeholder in the codebase:
- Leadership group photos → upload to `public/images/groups/` (3 files, exact names — see About session note)
- Other leader photos → upload to `public/images/leaders/` (only `henri-otunga.jpg` exists), update `photo_url` in DB via admin portal
- Real sub-county representative phone numbers (all 12 sub-counties currently reuse the main number)
- DONE: ✓ address ✓ email ✓ social links (WhatsApp) ✓ Google Maps embed ✓ schema.org telephone ✓ mission/vision ✓ org structure

**Task 4 — SEO files**
- ✓ **`/sitemap.xml` is generated dynamically** by a route in `server.js` — the 7 static public pages **plus** every published news + advocacy article (`?slug=…`, with `lastmod` from `updated_at`), so new content is discovered automatically. Referenced by `robots.txt`. (14 July 2026; **made live 17 July 2026** — the static `public/sitemap.xml` was deleted because `express.static` shadowed the dynamic route, so only the 7-page static file had ever been served. **Do not re-add a static `public/sitemap.xml`** or it will shadow the route again.)
- ✓ `public/robots.txt` — allow all, disallow portals/api/private uploads, points to sitemap
- ✓ Favicons for Google search — added 48/96/192/512px PNGs generated from `kuppetlogo.png` (Google needs ≥48px); `<link rel="icon" sizes="48x48"/"192x192">` added to all public pages. (14 July 2026)
- Still TODO: branded `og:image` 1200×630 px (currently reuses the square logo); canonical + full `og:url` on inner pages

**Task 5 — TalkSasa SMS (code complete; blocked on TalkSasa account)**
Code is done and correct (verified 21–22 June 2026):
- `smsService.js` posts to the **TalkSasa v3** API `https://bulksms.talksasa.com/api/v3/sms/send` with `{recipient, sender_id, type:'plain', message}` (the old `api.talksasa.com/v1` + `{to,...}` payload was wrong and failed every send). Default `TALKSASA_BASE_URL` updated; trailing slash stripped.
- **Delivery webhook** at `POST /api/sms/webhook` (`backend/routes/smsWebhook.js` → `smsController.webhook`) updates `sms_logs.status` from the DLR; robust to TalkSasa's varied field names.
- Diagnostics: `node backend/scripts/test-sms.js +2547… "msg"` (prints balance + raw send response).
- **Remaining (TalkSasa side, not code):** the **Sender ID must be network-registered with Safaricom/Airtel** — sends report "Delivered" but don't arrive (TalkSasa's own dashboard send fails the same way), which is the classic unregistered-sender-ID symptom. Set the approved/registered ID in `TALKSASA_SENDER_ID` and confirm `TALKSASA_BASE_URL=https://bulksms.talksasa.com/api/v3`, then register the webhook URL in the TalkSasa dashboard.

---

## Architecture

**Hybrid MPA**: Express serves static HTML files from `public/` as a traditional multi-page app. Public pages fetch data from `/api/*`. The member portal (`/public/member/`) and admin portal (`/public/admin/`) are separate authenticated SPAs within the same Express app.

### Request flow (public pages)
1. Browser loads HTML from `public/` (served as static files)
2. Page calls `api.*` methods from `public/js/api.js`
3. `api.js` hits `/api/*` → Express router → controller → mysql2 pool → JSON
4. `main.js` renders JSON into the DOM via `render*()` helpers + `escHtml()`

### Request flow (portals)
1. Browser loads portal HTML (e.g. `/admin/dashboard.html`)
2. Page calls `adminApi.*` / `memberApi.*` from the portal's own JS file
3. Requests carry `Authorization: Bearer <token>` + `X-CSRF-Token` cookie header
4. Express authenticates → controller runs → JSON response

### Backend layout
- **`backend/server.js`** — Express entry; mounts all middleware, registers all routes, bootstraps upload directories at startup
- **`backend/config/database.js`** — exports a single `mysql2/promise` connection pool
- **`backend/config/init.sql`** — authoritative schema (32 tables) + seed data; re-runnable
- **`backend/controllers/*.js`** — async functions; parameterised queries; `{ success, data, message }` responses. **All list endpoints clamp pagination** via `backend/utils/pagination.js` (`clampLimit`/`clampOffset`) — never bind raw `parseInt(req.query.limit)` to `LIMIT` (NaN → 500; unbounded → full-table dump).
- **`backend/utils/*.js`** — shared helpers: `pagination.js` (`clampLimit(v, def, max=100)` / `clampOffset(v)` — clamp `?limit`/`?offset` to `[1,100]` / `≥0`, NaN or missing → default), `sanitizeHtml.js` (rich-text XSS allowlist), `memberProfile.js` (required-profile-field list), `excel.js` (XLSX export)
- **`backend/routes/*.js`** — thin routers with `express-validator` on mutation routes
- **`backend/middleware/auth.js`** — `authenticate` (admin JWT), `authenticateMember` (member JWT), `authorizeAdmin`, `authorizeSuperAdmin`, `auditLog(action)` factory
- **`backend/middleware/csrf.js`** — double-submit cookie CSRF protection
- **`backend/middleware/upload.js`** — multer instances: `photo`, `document`, `bbfDocs`, `scholarshipDocs`, `memberDocs`
- **`backend/services/smsService.js`** — TalkSasa wrapper; `sendSms()`, `sendBulk()`; always logs to `sms_logs`; never throws
- **`backend/services/notificationService.js`** — `createNotification()` inserts into `notifications` + optionally triggers SMS/email; also owns the editable **application-notification templates** (`NOTIFICATION_TEMPLATES` defaults + `renderNotification(key, vars)` + `loadNotificationCache()`) for BBF/scholarship status messages
- **`backend/services/mailerService.js`** — nodemailer wrapper with email templates; fails gracefully

### Frontend layout

**Public site:**
- **`public/js/api.js`** — `window.api` with namespaced methods
- **`public/js/main.js`** — body-class guards, `DOMContentLoaded`, `escHtml()`, render helpers. Interpolate **all** attribute values through `escHtml()` — including image `src` and any admin-supplied URL; for `href`s use `safeUrl()` (allows only http/https/mailto/tel + relative paths, else `#`), since `escHtml()` alone doesn't neutralise a `javascript:` URL. Image tags carry an `onerror` icon fallback.

**Admin portal (`/public/admin/`):**
- **`admin/js/admin-api.js`** — `window.adminApi`; injects `adminToken` from localStorage; 401 → redirect to login
- **`admin/js/admin-portal.js`** — auth guard, sidebar init, page `init*()` functions, Chart.js integration, and the shared **`renderAdminPager(elId, {total, offset, limit, onPage})`** helper (a "N–M of T" + Prev/Next pager; each list page has a `<div id="…-pager">` and calls it after rendering rows, resetting `offset` to 0 when a filter changes). List controllers return `total` for this. SMS Logs uses its own inline pager.
- **Button loading state (automatic) —** `admin-api.js` tracks the last-clicked `button`/`.btn` (capturing listener) and, for the duration of the `request()`/`download()` it triggers, marks it busy via ref-counted **`setButtonBusy`/`clearButtonBusy`** (exposed on `window`): a CSS spinner (`.is-loading` in `portal.css`) replaces the label and the button is disabled + `pointer-events:none`, so double-clicks can't fire a duplicate request. **Zero per-button wiring** — any button that hits the API gets it; opt out with `data-no-busy`. `submitOnce(btn, fn)` (modal saves) uses the same helpers, so the two compose (ref-count) when a handler makes its own call. Spinner colour is captured from the button's text colour into `--btn-spinner` so it's legible on every variant. Added 20 July 2026.
- **List-table action cells (gotcha):** put the `display:flex` button wrapper on an **inner `<div>`, not the `<td>`**. A flex `<td>` leaves table layout, so the cell no longer stretches to the row height and its `border-bottom` renders misaligned from the rest of the row (most visible when the first column is two lines tall). Standard shape: `<td><div style="display:flex;gap:.3rem;flex-wrap:wrap">…buttons…</div></td>` (members / court-cases / disciplinary-cases, fixed 17 July 2026).
- 24 HTML pages — each uses `getSidebarHtml()` + `getTopbarHtml()` injected at runtime

**Member portal (`/public/member/`):**
- **`member/js/member-api.js`** — `window.memberApi`; injects `memberToken`; 401 → redirect to login
- **`member/js/member-portal.js`** — auth guard, sidebar, all `initMember*()` functions
- 12 HTML pages (incl. `forgot-password.html`, `reset-password.html`)

### Body-class convention (public pages)
Every `<body>` tag carries a class that gates the matching `init*` function in `main.js`:
- `home-page` → `loadHomepageData()`
- `news-page` → `initNewsPage()`
- `resources-page` → `initResourcesPage()`
- `about-page` → `initLeadershipPage()`
- `scholarships-page` → `initScholarshipsPage()`
- `advocacy-page` → `initAdvocacyPage()`
- `article-page` → `initArticlePage()` (news detail; reads `?slug=`)
- `advocacy-article-page` → `initAdvocacyArticlePage()` (advocacy detail; reads `?slug=`)

Admin and member portal pages use `admin-*-page` / `member-*-page` classes gating functions in their respective portal JS files.

### Asset cache-busting (IMPORTANT)
Public CSS/JS links carry a version query, e.g. `href="/css/style.css?v=20260622b"`. **When you edit `style.css`, `portal.css`, `main.js`, `api.js`, or any portal JS (`admin/js/admin-api.js`, `admin/js/admin-portal.js`, `member/js/member-api.js`, `member/js/member-portal.js`), bump the `?v=` string on every page** (sed across `public/**/*.html`) or returning visitors won't see the change. **HTML is served with `Cache-Control: no-cache` so it always revalidates** (ETag → 304 when unchanged) — set via `setHeaders` on the `express.static` mount in `server.js`, so a deploy (and the bumped `?v=` refs the HTML contains) is visible immediately. *(Before 17 July 2026 the whole static mount had `max-age=1d`, so browsers cached the homepage — incl. the ticker markup — for 24h and never re-fetched to see admin changes; that's fixed.)* Current token: `20260725j` (bumped 26 July 2026 — **school picker replaces `<datalist>` on member pages** (datalists render unreliably / not at all on mobile). New self-contained `public/js/school-picker.js` turns any `<input data-school-picker>` into a touch-friendly typeahead sourced from `GET /api/schools` (pointerdown-based selection so it works on phones); styles `.school-picker*` in `portal.css`. Applied to `register.html` + member `profile.html` (their old `<datalist>` removed; register's `KNOWN_SCHOOLS` validation now reads `SchoolPicker.load()`). Admin filter pages still use the datalist (desktop). NOTE: the dropdown is only non-empty once **migration #25** has seeded the `schools` table. `20260725i` was **scholarship flow now mirrors BBF**. Added a **Start Review** action (applied → under_review, `adminApi.schApps.startReview` → `PUT /api/admin/scholarship-apps/:id/review`, `authorizeAdmin`) so the previously-dead "Under Review" tab/status actually works, plus a `scholarship_under_review` notification. Added a **status timeline** (`scholarship_application_timeline`, migration #26): the member `apply` opens it, and startReview/approve/reject/markPaid each append a row (best-effort — see migration note); the admin `scholarship-app-detail.html` now shows a **Status Timeline** card + a Start Review button, mirroring `bbf-detail.html`. Touches `adminSchAppController`, `memberScholarshipController`, `notificationService`, `admin-api.js`. `20260725h` was the **school-name autocomplete**. A curated `schools` table (migration #25, seeded from existing member entries) feeds an HTML `<datalist>` on member registration (`register.html`), member profile (`profile.html`), and the admin school filters (members/BBF/scholarship lists) so the same school is spelled one way. Public source `GET /api/schools`; a shared `loadSchoolsDatalist()` helper in both `admin-portal.js` and `member-portal.js` (register uses an inline fetch). New admin **Schools** management page (`schools.html`, sidebar under Members) with search + add/edit/delete via `adminApi.schools.*` → `/api/admin/schools`. `20260725g` was **print is now details-only, period**. Removed the "Print + Attachments" button and all attachment-printing machinery: `printApplication` no longer takes `documents`/`includeDocuments` (just `heading`/`subheading`/`sections`/`footer`), the `ensurePdfJs`/`blobToDataUrl`/`pdfToImageDataUrls` helpers are deleted, and the vendored `public/vendor/pdfjs/*` (~1.5 MB) is removed. `fetchDocBlob`/`viewDoc` stay (the on-screen document viewer). Callers `printClaim()`/`printApp()` no longer build a documents list. `20260725f` was **fast details-only print** (now the only print) on BBF-claim + scholarship-application detail pages. `printApplication` (in `admin-portal.js`) gained an `includeDocuments` option: when false it skips the slow attachment fetch + PDF.js page rendering entirely (that loop is what made "Preparing document & attachments…" hang). Each detail page now has two buttons — **Print** (`printClaim(false)`/`printApp(false)`, details only, fast) and **Print + Attachments** (`…(true)`, full record). `20260725e` — **fix: SMS Group send was broken**. `sms.html`'s group send used a raw `fetch('/api/admin/sms/group')` that omitted the `X-CSRF-Token` header, so `csrfProtection` (enforced on all `/api/admin` mutations) returned 403 every time. Added `sms.group` to `admin-api.js` (mirrors `email.group`) and switched the page to `adminApi.sms.group(...)`, which sends the CSRF header via the shared `request()` helper. It was the only raw-fetch mutation left in the admin portal. Same batch — comms polish: `smsService.normalizePhone` now also handles bare 9-digit `7…`/`1…` numbers (→ `254…`); the Send SMS composer counter shows `"N chars · M SMS"` (160/153-char segments) instead of a misleading `/160`; and SMS/email template **create** routes now require name/body (+subject for email) via split create/update validators (`templateCreateRules`/`templateUpdateRules`). `20260725d` clarified the **Birth Notification** BBF death-claim slot wording — it was already optional (not in the `submitClaim` required list; `required:false` in `BBF_DOC_SLOTS_DEATH`), only its note was ambiguous ("For Children" → "Optional — only for a child's death"). `20260725c` was **scholarship document re-upload** — a member may replace either required document while the application is still awaiting review (status `applied`): `memberScholarshipController.reuploadDocument` + `POST /api/member/scholarships/applications/:id/documents` (single `file` + `doc_type`; swaps the existing doc row; 400 once past `applied`), `getApplications` now attaches each application's `documents`, `scholarships.reuploadDoc` in `member-api.js`, and per-document Choose/Replace controls on `scholarship-applications.html` (`renderSchDocSlots` in `member-portal.js`). Scholarships have **no draft stage** — applications are submitted atomically at `applied`, so the BBF draft-leak issue does not apply. `20260725b` was **BBF draft handling** — (1) admin BBF list/count/export now exclude `draft` claims via `buildBbfFilter` (`WHERE bc.status <> 'draft'`) so members' unsubmitted work-in-progress never enters the admin queue [analytics already excluded drafts; the monthly-claims chart now does too]; (2) members can **edit a draft** claim before submitting — `memberBbfController.update` + `PUT /api/member/bbf/:id` (draft-only guard), `bbf.update` in `member-api.js`, and an "Edit Details" button + edit modal on `bbf-claim-detail.html` wired in `member-portal.js`. `20260725a` was the scholarship-applications **Excel export** — an Export button on `scholarship-apps.html` mirroring BBF: `adminSchAppController.exportExcel` + `GET /api/admin/scholarship-apps/export` (honours the active status/scholarship/applicant filters via the new shared `buildSchFilter`), `schApps.exportExcel` in `admin-api.js`. `20260724i` was scholarship **mark-as-paid** — approved applications can be marked paid by an admin like BBF: `scholarship_applications` gains `paid` status + `payment_reference`/`payment_date` (migration #24), `adminSchAppController.markPaid` + `PUT /api/admin/scholarship-apps/:id/paid`, a Payment card on `scholarship-app-detail.html`, a Paid tab on the list, `schApps.markPaid` in `admin-api.js`, and a `scholarship_paid` notification (email+in-app+SMS, includes award amount + optional ref). `20260724h` was two scholarship changes: (1) the member scholarship-application form was **simplified to only the two required uploads** — Institution/Course/Year of Study/Academic Year/Essay text fields removed from `member/scholarships.html`, `applyRules` emptied in `memberScholarships.js` (controller already inserts null for them); (2) admins can **award an amount on approval** — `scholarship_applications.amount_awarded` (migration #23), amount input on `scholarship-app-detail.html`, `adminSchAppController.approve` stores it + passes `{{amount}}` to the `scholarship_approved` notification (optional `{{#amount}}` clause); touches `admin-api.js`. `20260724g` made Application Notifications email-only — removed the SMS field from the notification edit view (SMS now always uses the code default); `20260724f` added **editable application-notification templates** — a new "Application Notifications" tab on the Email Templates page edits the title/message/SMS of the 8 BBF + scholarship status notifications, backed by `notification_templates` (migration #22) + `notificationService.NOTIFICATION_TEMPLATES`/`renderNotification`; the 4 controllers now delegate their inline wording to it; touches `admin-api.js`. `20260724e` was **editable automated (transactional) emails** — the Email Templates page gained an "Automated Emails" tab to edit the subject/body of the 5 system emails, backed by `transactional_templates` (migration #21) + `mailerService.TRANSACTIONAL_TEMPLATES`; touches `admin-api.js`. `20260724d` was the **Email Templates** feature — new `email-templates.html` admin page mirroring SMS Templates (name + subject + body + category), backend CRUD on `email_templates` (migration #20), sidebar item under Communications, and a template picker added to all three Send Email panels; touches `admin-portal.js` sidebar + `admin-api.js`. `20260724c` was per-claim-type BBF required documents — retirement claims now require TSC Slip + Letter of Compulsory Retirement instead of the death-claim burial-permit/letter-from-principal set; touches `member-portal.js` doc slots, `memberBbfController.submitClaim`, DB ENUM via migration #19. `20260724b` was **Tertiary School** as a third `school_category` option — register + profile dropdowns, both validators, both `bbfSchoolCatLabel` helpers, DB ENUM via migration #18. `20260724a` earlier same day was the registration fix — `member/js/member-api.js` now surfaces the first express-validator error instead of a bare "Error 400" that hid which field failed, and `member/register.html` enforces the server password rule client-side (≥8 chars incl. a letter & a number) plus a show/hide password toggle on both password fields. `20260723c` was a same-week bump; `20260723b`/`20260723a` were the 23 July content-editor **WYSIWYG** upgrade — the News/Advocacy content field is a live contenteditable surface (bold/italic/lists/align/link via `document.execCommand`, no visible HTML tags) that mirrors into the hidden `textarea name="content"`; plus removable image/attachment, and `main.js` `renderArticleHtml()` reflows legacy plain-text articles into paragraphs on the public site. See `docs/SESSION-NOTES.md` for the per-token change history).
> ✓ Portal JS is now **versioned too** (as of 20 July 2026): the `<script src>` tags for `admin/js/admin-api.js`, `admin/js/admin-portal.js`, `member/js/member-api.js`, `member/js/member-portal.js` all carry `?v=` and are covered by the bump convention above — so a portal-JS change reaches returning admins/members on next visit without a manual hard-refresh. (Previously these were unversioned and relied on browser revalidation, which silently served stale JS — that's why the button loading-state change wasn't visible on already-open sessions until this was added.)

### Responsive header (public pages)
All public pages share an identical topbar + header (only the active nav link differs — keep them in sync). Layout bands (driven by media queries in `style.css`):
- `≤1780px` — hide the logo tagline + tighten nav (full header doesn't fit beside both CTA buttons)
- `≤1300px` — header CTA buttons become icon-only (`.cta-label` hidden)
- `≤960px` — inline nav collapses into the slide-in **hamburger drawer** (`.main-nav`); CTAs move into `.nav-cta` inside the drawer; `main.js` hamburger/dropdown breakpoints also use `960`
The "Get Help" (→ contact) + "Member Login" (→ member login) buttons live in `.header-cta` (desktop) and are duplicated in `.nav-cta` (drawer).

### Mobile card rows — `.h-scroll` (26 June 2026)
Add the **`.h-scroll`** class to a card-grid container so that at **≤640px** it becomes a horizontal scroll-snap row (instead of stacking into a long vertical scroll); add `.h-scroll--sm` for compact cards. Defined once in `style.css` with `!important` so it overrides per-page inline grid media queries. Cards size `clamp(220px,82%,300px)` so the next peeks. Applied to: `.news-grid` (incl. homepage featured news), `.leaders-grid`, `.scholarship-cards`, `.advocacy-cards`, `.category-cards`, `.services-grid`, `.values-grid-4`, `.group-photos-grid` (the JS-rendered ones get the class in `main.js`). **Gotcha:** if an `.h-scroll` sits inside a CSS-grid parent (e.g. `.news-layout`), give that parent `minmax(0,1fr)` tracks or the wide row blows the track out to min-content and forces page-wide horizontal overflow.

### Admin roles
| Role | Access |
|------|--------|
| `super_admin` | Full access to everything |
| `branch_officer` | Can review/recommend **and make all member/application decisions** (approve, reject, suspend, delete, mark-paid); cannot delete admins, change system settings, or access audit logs |
| `branch_secretary` | Peer of `branch_officer` for viewing/reviewing/printing, **but makes no member/application decisions** and is excluded from the Legal / Court Cases section (10 July 2026) |
| `content_admin` | **Content-only** (20 July 2026): the Content section only (news/events/resources/leadership/scholarship listings/advocacy/announcements) + own Account Security; blocked from members, welfare, legal, communications, contacts, administration. |

Middleware: `authorizeAdmin` allows the three full roles (`ADMIN_ROLES` in `auth.js`). **`content_admin` is excluded from `ADMIN_ROLES`** (denied by `authorizeAdmin`/`authorizeSuperAdmin`/`authorizeRoles`); the seven content routes instead use **`authorizeContent`** = `authorizeRoles('branch_officer','branch_secretary','content_admin')` — so it reaches content and nothing else. Frontend: login lands it on `/admin/content-news.html`; `initSidebar` hides non-`data-content-ok` nav and redirects off out-of-scope pages (`CONTENT_ADMIN_PATHS`). Assignable/validated in `users.html` + `adminUsers.js`. Migration #15. `authorizeSuperAdmin` allows only `super_admin`. `authorizeRoles(...roles)` is a factory that allows `super_admin` plus the listed roles (used as `authorizeRoles('branch_officer')` for court-cases and for all decision routes below). `branch_officer` and `branch_secretary` are blocked from every `authorizeSuperAdmin` route: admin-user management, settings, audit logs. (2FA setup/enable/disable at `POST/DELETE /api/auth/2fa/*` is self-service — each admin manages only their own; no route disables another's.) All three full admin roles (not `content_admin`) can also use: the dashboard analytics PDF (`GET /api/admin/analytics/export-pdf`, 10 Jul), member & BBF Excel exports (`/api/admin/members/export`, `/api/admin/bbf/export`, 12 Jul), and all Communications — SMS/email send/bulk/group + SMS templates (`adminSms.js`/`adminEmail.js`, 13 Jul); these were `authorizeSuperAdmin` before.

**Member/application decisions → branch_officer + super_admin (10 July 2026).** Restricted via `authorizeDecision = authorizeRoles('branch_officer')`: member approve/reject/suspend/delete (`adminMembers.js`), BBF claim approve/reject/mark-paid (`adminBbf.js`), scholarship-app approve/reject (`adminScholarshipApps.js`). `branch_secretary` can **view/print** these and start BBF review (`/:id/review` stays `authorizeAdmin`) but makes no final decisions. Detail/list pages compute `canDecide = role ∈ {super_admin, branch_officer}` and hide the decision buttons for others; the backend gate enforces it regardless.

**Members admin list (`members.html`).** Filters: status tabs · search (name·TSC·email) · **school** search (`school_name LIKE`) · sub-county · gender. All are built once in `adminMembersController.buildMemberFilter(req.query)`, shared by the list, the count, **and** the Excel export (`GET /api/admin/members/export`) so they stay in sync — the Export button posts the active filters. Columns include **ID No** (`national_id`). ⚠ `national_id` is the bulk-import **default password** until changed, so the ID No column (and member-detail) exposes those defaults to any admin viewing the screen.

**BBF Claims (`bbf.html`) + Scholarship Applications (`scholarship-apps.html`) list filters (24 July 2026).** Both admin lists gained the same applicant filters as Members — **school category, sub-county, school (LIKE), gender** — on top of their status tabs. They filter on the JOINed `members m` columns (`m.school_category`/`m.sub_county`/`m.school_name`/`m.gender`), so gender (not stored on the claim/app) works too. BBF: added to `adminBbfController.buildBbfFilter` (so list, count **and** Excel export all share them; the Export button posts the active filters). Scholarship: added inline in `adminSchAppController.getAll`. Frontend filter-bar + debounced school search mirror the Members page. HTML-only + backend change (no versioned-asset bump).

Sidebar cosmetics (backend gates enforce): `data-super-only` hidden for non-super roles, `data-court-only` for roles outside {`super_admin`,`branch_officer`}, and everything but `data-content-ok` for `content_admin`.

> The old unused `editor`/`viewer` roles were pruned (9 July 2026). `users.role` is now `super_admin | branch_officer | branch_secretary | content_admin` (default `branch_officer`); the dropdown and validators offer only these. `content_admin` (20 July 2026) is the first capability-scoped role (not a peer) — via `authorizeContent` + exclusion from `ADMIN_ROLES` (see Admin roles); follow this pattern for future scoped roles rather than a peer role with no route access.

### JWT setup
Two separate secrets are **required** and must differ:
- `JWT_SECRET` — signs admin tokens (7-day expiry)
- `JWT_MEMBER_SECRET` — signs member tokens (30-day expiry)

Server throws at startup if they are equal.

### Startup guards (server.js refuses to boot if violated)
- `JWT_SECRET` ≠ `JWT_MEMBER_SECRET` (above).
- `TOTP_ENCRYPTION_KEY` must be **64 random hex chars** (32 bytes) and not all-zero — generate with `openssl rand -hex 32`. (Encrypts admin 2FA secrets at rest; the old all-zero default was removed.)
- In production (`NODE_ENV=production`), `FRONTEND_URL` must be set (CORS origin — no localhost fallback).

### Auth identifiers
- **Members** log in with **TSC number + password** (`members.tsc_number`). Email is still collected at registration (unique) but isn't the login identifier. Password reset is by email (see forgot/reset flow).
- **Admins** log in with **email + password** (+ optional TOTP 2FA).

### Bulk member import + forced first-login onboarding (14 July 2026)
Rosters are imported as **active** members via an offline script → SQL for phpMyAdmin (`node backend/scripts/import-members.js <xlsx> --start-seq <member_seq> --out members-import.sql`); default password = the member's **national ID**. Two `members` flags drive a forced first-login flow: `must_change_password` (1 → locked to `/member/first-login.html` until a new password ≠ ID is set via `POST /api/member/auth/first-password`) and `onboarding_complete` (0 → locked to `/member/profile.html` until all `REQUIRED_PROFILE_FIELDS` are filled; `updateProfile` flips it to 1 automatically). Existing members default to `must_change_password=0`/`onboarding_complete=1`, so the flow is a no-op for them. The client guard is `enforceMemberOnboarding()` in `member-portal.js`; `login`/`getMe`/`getProfile` all return `must_change_password`/`onboarding_complete`/`profile_complete`/`missing_fields`. Required-field list lives in `backend/utils/memberProfile.js`. Members can now self-edit `email`/`gender`/`date_of_birth` in profile (email uniqueness enforced). Full runbook: **`docs/MEMBER-IMPORT.md`**. Needs migration #12 first.

### Email (SMTP) — required for password reset & notification emails
`backend/services/mailerService.js` sends via nodemailer when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are set (else it logs & skips). `sendMail()` supports an optional `replyTo`. `APP_URL` (e.g. `https://kuppetmigori.co.ke`) is used to build links in emails (password reset). Live uses the Hostinger mailbox for `info@kuppetmigori.co.ke` (`smtp.hostinger.com:465`). Test with `node backend/scripts/test-email.js you@example.com`.

**Editable automated (transactional) emails (24 July 2026, migration #21).** The automated emails are defined in `mailerService.TRANSACTIONAL_TEMPLATES` with a subject + HTML body carrying `{{placeholders}}`. **Four are admin-editable**: `registration_received`, `membership_approved`, `membership_rejected`, `contact_acknowledgement`. **`password_reset` is intentionally NOT editable** (`editable: false` on its registry entry — security-sensitive, depends on the one-time `{{reset_link}}`); it still renders/sends normally but is hidden from the admin API and `PUT`/`DELETE` on it return 403. Defaults are the source of truth; per-key overrides live in the `transactional_templates` table and are cached in memory (single Hostinger instance) — loaded at startup via `loadTransactionalCache()` (called in `server.js`) and refreshed after each save. `renderTransactional(key, vars)` interpolates (body values HTML-escaped, subject values raw) and the existing `templates.memberRegistered/memberApproved/memberRejected/passwordReset/contactAutoReply` delegate to it, so **all callers stay unchanged** and output is byte-identical to the old hardcoded templates when no override exists. Edited on the **Email Templates → Automated Emails** tab (`email-templates.html`); API `GET /api/admin/email/transactional` (editable only), `PUT /:key`, `DELETE /:key` (reset to default), all `authorizeAdmin`. The other mailer templates (`memberNotice`, `adminEmail`, `contactStaffAlert`, `contactReply`) remain hardcoded (dynamic/internal body). **Plain-text editing (24 July 2026):** the 4 editable transactional templates are marked `plainText: true` and their defaults are stored as **plain text** (no HTML tags) — admins type normally (blank line = paragraph) and `mailerService.plainToHtml()` renders paragraphs + auto-links emails/URLs at send time, matching the old polished look. The editor (Automated Emails tab) is a normal textarea, no "HTML" framing. `renderTransactional` still renders as HTML when the body **looks like** HTML (regex guard) so any legacy HTML override keeps working; `password_reset` stays HTML (has the styled button, and isn't editable anyway). `memberNotice` (application notifications) and `adminEmail` (Send Email composer) already `nl2br` their plain-text bodies, so they were plain-text friendly already.

**Editable application-notification templates (24 July 2026, migration #22).** The BBF-claim and scholarship-application **status notifications** are editable — **email + in-app only** (the SMS wording is intentionally kept as the code default, since Email Templates is an email-focused page). The 8 events (`bbf_submitted`, `bbf_under_review`, `bbf_approved`, `bbf_rejected`, `bbf_paid`, `scholarship_submitted`, `scholarship_approved`, `scholarship_rejected`) are defined in `notificationService.NOTIFICATION_TEMPLATES` with an editable **title** and **body** (used for the email body **and** the in-app notification), plus a **sms** default. Templates support `{{placeholders}}` **and** `{{#var}}…{{/var}}` / `{{^var}}…{{/var}}` sections (show text only when a value is set / unset — e.g. the approved amount, rejection reason, payment ref). Each controller call site computes the vars and calls `renderNotification(key, vars)` → `{ title, body, sms }` (verified byte-identical to the old inline wording, including optional-clause spacing) before `createNotification(...)`. **`renderNotification` always renders `sms` from the code default**, ignoring any override, so the text-message channel stays code-controlled; the admin edit UI only exposes title + message, and `update` stores the default sms into the (NOT NULL) `sms` column. Title/body overrides live in `notification_templates` (cached in memory; `loadNotificationCache()` at startup + after each save). Edited on the **Email Templates → Application Notifications** tab; API `GET/PUT/:key/DELETE/:key` at `/api/admin/notification-templates` (`notificationTemplateController` + `adminNotificationTemplates.js`), all `authorizeAdmin`.

**Contact form (26 June 2026):** on submit the controller emails the branch inbox (`CONTACT_EMAIL`, falls back to `SMTP_USER`; reply-to = enquirer) and auto-acknowledges the enquirer. **Advocacy-category** enquiries route to `ADVOCACY_EMAIL` (`advocacy@kuppetmigori.co.ke`) instead. Admins reply from the Contact Inbox via `POST /api/contact/:id/reply` (emails the enquirer, stores `admin_reply`/`replied_at`, marks `replied`). All fail gracefully if SMTP is unconfigured.

**Advocacy reports access (10 July 2026):** contacts with `category = 'advocacy'` (the Advocacy Desk issue reports) are restricted to `branch_officer` + `super_admin`; `branch_secretary` is excluded. `contactController` filters advocacy rows out of the admin list/count and returns 403 on reply/restatus of an advocacy contact for non-advocacy roles (`canViewAdvocacy`); the Contact Inbox hides the `[data-advocacy-only]` "Advocacy Reports" filter chip for them. **Advocacy replies (25 July 2026 — fixed):** `POST /api/contact/:id/reply` routes advocacy-category replies through `mailerService.sendAdvocacyMail` (not `sendMail`). If the advocacy mailbox has its **own SMTP login** (`ADVOCACY_SMTP_USER` + `ADVOCACY_SMTP_PASS`; host/port default to `SMTP_HOST`/`SMTP_PORT`), the reply is sent authenticated as — and genuinely **From** — `advocacy@`. Otherwise it falls back to the main SMTP login, branded `"KUPPET Migori Advocacy Desk" <SMTP_USER>` with **Reply-To** `advocacy@` — which always delivers and still routes replies to advocacy@. ⚠ **Why the old code failed:** it set `from: advocacy@` over the `info@` SMTP login, and Hostinger (like most servers) **rejects a From it isn't authenticated for** — so every advocacy reply 502'd. Setting `ADVOCACY_EMAIL` alone is NOT enough (that's just the address); to truly send From advocacy@, add its SMTP credentials (see `.env.example`).

> ⚠ **Rate-limit scoping (10 July 2026):** `contactLimiter` (5/hr) is now applied only to `POST /api/contact` (the public form) — previously `app.use('/api/contact', contactLimiter)` covered the whole path, so admins loading the Contact Inbox (`GET /api/contact`) a handful of times hit the limit and saw the public "Too many contact submissions" message. The admin reads/replies/status are no longer rate-limited by it.

### Database schema (32 tables)
**Core (public site):** `users`, `leadership`, `news`, `events`, `resources`, `scholarships`, `advocacy`, `contacts`, `settings`, `announcements`

> `announcements` — the homepage scrolling ticker items (`text`, optional `link`, `sort_order`, `is_active`). Public `GET /api/announcements` returns active items in order; admin CRUD at `POST/PUT/DELETE /api/announcements` (both roles) via the **Ticker Announcements** content page (`content-announcements.html`). The homepage renders them in `main.js` `loadAnnouncements()` (items duplicated for the -50% CSS marquee loop). **The admin page is the single source of truth — there is no hardcoded fallback:** `#ticker-bar` in `index.html` starts `display:none` with an empty `#ticker-content`; `loadAnnouncements()` reveals the bar only when there are active items and keeps it hidden on empty/failed fetch. (Removed the old hardcoded `<span class="ticker-item">` fallback on 17 July 2026 — combined with the HTML no-cache fix, it was showing stale placeholder items on the live homepage.)

**Membership:** `members`, `bbf_claims`, `bbf_claim_documents`, `bbf_claim_timeline`, `scholarship_applications`, `scholarship_application_documents`, `notifications`

**SMS & comms:** `sms_logs`, `sms_templates`, `email_logs` (email send history/progress, mirrors `sms_logs`; admin Email Logs page), `email_templates` (reusable email subject + body; admin **Email Templates** page mirrors SMS Templates and is picked in the Send Email composer to fill subject + message — migration #20, 24 July 2026), `transactional_templates` (admin-editable overrides for the automated system emails — migration #21, 24 July 2026; see the mailer section), `notification_templates` (admin-editable overrides for the BBF/scholarship status notifications — title + message + SMS; migration #22, 24 July 2026; see the notifications section)

**Security & audit:** `audit_logs`, `login_history`, `admin_2fa`

**Legal:** `court_cases`, `court_case_updates`, `court_case_documents` (court-case tracker for branch officers; shared branch-wide, each case has a responsible `officer_id`, a dated updates/hearings log, and file attachments. Attachments live in the access-controlled `court/` upload dir, 404-blocked from static and served only via `GET /api/admin/documents/:filename` — its ownership UNION includes `court_case_documents`. Admin API at `/api/admin/court-cases`; pages `court-cases.html` + `court-case-detail.html`; dashboard summary via `getStats`. **Access restricted to `branch_officer` + `super_admin`** via `authorizeRoles('branch_officer')` in `courtCases.js`; `branch_secretary` is excluded — the shared `/api/admin/documents/:filename` endpoint also drops the `court_case_documents` UNION branch for non-court roles, and the sidebar/dashboard `[data-court-only]` items are hidden from them.)

**Legal (disciplinary):** `disciplinary_cases`, `disciplinary_case_updates`, `disciplinary_case_documents` (teacher **disciplinary-matter** tracker — the TSC/employer disciplinary process, distinct from court litigation. Added 17 July 2026, migration #13). Each case records the teacher (`teacher_name`, `tsc_number`, `school`, `sub_county`), `offence_category`, `description`, a disciplinary `status` (stage) + `outcome`, key dates (`reported_date`/`interdiction_date`/`hearing_date`/`resolved_date`), a responsible `officer_id`, plus a dated updates log and document attachments (access-controlled `disciplinary/` upload dir, served only via `GET /api/admin/documents/:filename` — same `canViewLegal` gate as court docs). Admin API at `/api/admin/disciplinary-cases` (`disciplinaryCases.js` → `disciplinaryCasesController.js`); pages `disciplinary-cases.html` + `disciplinary-case-detail.html`; **same access as Court Cases** — `branch_officer` + `super_admin` via `authorizeRoles('branch_officer')`; `branch_secretary` excluded; sidebar item is `[data-court-only]` under the Legal section.)

Key ENUM values:
- `users.role`: `super_admin | branch_officer | branch_secretary | content_admin` (default `branch_officer`; `content_admin` = content-only, migration #15)
- `members.status`: `pending_approval | approved | rejected | suspended`
- `members.gender`: `male | female | other`
- `members.school_category`: `senior_school | junior_school | tertiary_school` (nullable; captured at registration, editable in profile; `tertiary_school` added 24 July 2026, migration #18)
- `members.job_group`: TSC grade `B5 | C1 | C2 | C3 | C4 | C5 | D1 | D2 | D3 | D4 | D5` (nullable; required at new registration + first-login onboarding, editable in profile; existing/imported members null until set — migration #14)
- `bbf_claims.status`: `draft | submitted | under_review | approved | rejected | paid`
- `bbf_claims.claim_type`: `death | retirement` (was `death_benefit/disability/medical_emergency/other` before 21 June 2026)
- `bbf_claims.school_category`: `senior_school | junior_school | tertiary_school` (`tertiary_school` added 24 July 2026, migration #18)
- `scholarships.scholarship_type`: `kcse | kjsea | dte` (was `undergraduate/postgraduate/vocational/research/international` before 21 June 2026; DTE = Diploma in Technical Education)
- `scholarship_applications.status`: `applied | under_review | approved | rejected | paid` (`paid` + `payment_reference`/`payment_date` added 24 July 2026, migration #24 — admin mark-as-paid like BBF; also `amount_awarded DECIMAL NULL` — award set by admin on approval, migration #23; the study-detail columns `institution`/`course`/`year_of_study`/`academic_year`/`essay` are now null for new apps since the form was simplified to just the two required uploads on 24 July 2026)
- `scholarship_application_documents.doc_type`: `letter_of_application | tsc_slip | kcse_cert | admission_letter | fee_structure | recommendation | other` (the first two are the mandatory member uploads added 3 July 2026)
- `court_cases.case_type`: `employment | disciplinary | criminal | civil | constitutional | appeal | other`
- `disciplinary_cases.offence_category`: `misconduct | absenteeism | exam_irregularity | financial | insubordination | negligence | criminal | other`
- `disciplinary_cases.status` (stage): `reported | query_issued | interdicted | hearing | determined | appealed | closed` · `disciplinary_cases.outcome`: `pending | warning | suspension | dismissal | reinstated | cleared | other`
- `court_cases.status`: `open | ongoing | on_hold | closed` · `court_cases.outcome`: `pending | won | lost | settled | withdrawn | dismissed` (added 3 July 2026)
- `news.category`: `news | announcement | circular | press_release | event | sport_entertainment` (sport_entertainment added 26 June 2026; news rows also carry `image_2`, `document_url`, `document_name`)
- `resources.category`: `curriculum | circular | moe_document | tsc_resource | professional_dev | teaching_material | legal | policy | sport_entertainment` (sport_entertainment added 26 June 2026)
- `contacts.category`: `general | membership | bbf | advocacy | resources | complaint | other` (contacts also carry `admin_reply` + `replied_at`, added 26 June 2026)
- `contacts.status`: `new | read | replied | closed`

### BBF claims data model (restructured 21 June 2026)
Two claim types only: **`death`** and **`retirement`**. A claim stores a snapshot of claim particulars: `deceased_name`, `tsc_no`, `sub_county`, `school`, `school_category`, `relationship`, `date_of_death` (plus the existing `amount_requested`/`amount_approved`, set by admins during review).

The member **does not re-enter** their own identity. `memberBbfController.create` ignores client-sent identity and pulls `tsc_no`, `sub_county`, `school`, `school_category` from the logged-in member's `members` row:
- **`retirement`** — the claim's `deceased_name` is set to the member's own `full_name` (the retiree); `relationship`/`date_of_death` are null.
- **`death`** — the member enters the deceased relative's name, `relationship`, and `date_of_death`; identity fields still come from the profile.
- Creating a claim is blocked (400) if the member's `school_category` is unset → they must set it in their profile first.

The new-claim form (`member/bbf-claims.html`) shows the member's identity in a read-only "Your details (from your profile)" box; the member only chooses type + (for death) deceased name/relationship/date of death. **Required upload documents differ by claim type** (24 July 2026): **death** → TSC Slip, Burial Permit, Letter from Principal (+ optional Birth Notification); **retirement** → TSC Slip + Letter of Compulsory Retirement. Enforced in `memberBbfController.submitClaim` (per-type `required` list) and mirrored in the member detail page's doc slots (`bbfDocSlotsFor(claimType)` in `member-portal.js`). The `letter_of_compulsory_retirement` value was added to `bbf_claim_documents.doc_type` ENUM in migration #19; admin `bbf-detail.html` `DOC_LABELS` maps it too.

### Sequence number generation (atomic)
Member numbers (`MBR-YYYY-NNNNNN`), BBF claim numbers (`BBF-YYYY-NNNNNN`), and scholarship application numbers (`SAPP-YYYY-NNNNNN`) use atomic MySQL counters stored in the `settings` table (`member_seq`, `bbf_seq`, `schapp_seq`). Never use `COUNT(*)+1`.

### File uploads
Files are stored under the upload root with UUID filenames (multer **2.x**), in subdirs `photos/`, `documents/`, `bbf/`, `scholarships/`, `members/`, `news/`, `court/`, `disciplinary/`. The sensitive subdirs — `members/`, `bbf/`, `scholarships/`, `court/`, `disciplinary/` — are **404-blocked from static serving** in `server.js` (before the `/uploads` static); only `photos/`, `documents/`, `news/` are public. Sensitive files are streamed only through ownership/role-checked endpoints:
- **Members:** `GET /api/member/documents/:filename` — verifies the file belongs to the logged-in member.
- **Admins:** `GET /api/admin/documents/:filename` (`backend/routes/adminDocuments.js`) — `authenticate` + `authorizeAdmin`; admin detail pages fetch these as a blob via `viewDoc()` in `admin-portal.js` (a plain link can't send the Bearer token).

DB stores URL paths (`/uploads/<sub>/<file>`); these are served from the filesystem **upload root** at request time. A missing `/uploads/*` file now returns a real **404 JSON** (not the SPA `index.html`), so broken `<img>`s fail fast and hit their `onerror` fallback.

**⚠ Uploads must live OUTSIDE the git-deployed tree (persistent dir).** `public/uploads/` is git-ignored, and Hostinger's GitHub auto-deploy **restores the working tree on every deploy → all runtime uploads are wiped** (this is what blanked the admin-uploaded leader photos on 25 June). The upload root is centralised in `backend/config/paths.js` and configurable via the **`UPLOAD_DIR`** env var:
- Local dev: leave `UPLOAD_DIR` unset → falls back to `./public/uploads`.
- **Live (Hostinger): set `UPLOAD_DIR` to an absolute path above `public_html`** (e.g. `/home/u735599564/uploads`), create that dir once via SSH (`mkdir -p`), and the app reads/writes/serves there so files survive redeploys. Set it in hPanel → Environment variables.
- Lost files (uploaded before the persistent dir was configured) are only recoverable from a Hostinger backup snapshot taken **before** the wiping deploy; otherwise re-upload.

### Rate limiting
**All limits are per client IP.** The limiters (`express-rate-limit` v7, `backend/server.js`) set no custom `keyGenerator`, so they use the default key = `req.ip`; each IP gets its own independent counter per limiter. `app.set('trust proxy', 1)` (server.js:47) makes `req.ip` the **real client IP** from `X-Forwarded-For` (first hop = Hostinger's nginx/Passenger), not the proxy's — required, or every request would share one bucket. Caveats: (1) the store is **in-memory**, so counts reset on restart/redeploy and aren't shared across multiple instances/workers (fine on single-instance Hostinger; use a shared store like Redis if ever scaled out); (2) users behind one shared/NATed public IP (e.g. a whole school) share a bucket.

| Endpoint | Limit (per IP) |
|----------|-------|
| All `/api/*` | 200 req / 15 min |
| `POST /api/contact` | 5 req / hr |
| `POST /api/auth/login` | 20 req / 15 min |
| `POST /api/member/auth/login` | 20 req / 15 min |
| `POST /api/member/auth/register` | 8 req / hr (only **successful** registrations count — `skipFailedRequests`) |
| `POST /api/member/auth/forgot-password` | 5 req / hr |
| `POST /api/member/scholarships/:id/apply` | 30 req / 15 min (tune via `SCH_APPLY_RATE_MAX`; runs before the upload; the `UNIQUE(member,scholarship)` key blocks true duplicates) |
| `POST /api/admin/sms/send` | 20 req / min |
| `POST /api/admin/sms/bulk` | 3 req / hr |
| `POST /api/admin/email/send` | 20 req / min |
| `POST /api/admin/email/bulk` | 5 req / hr |

### Design tokens (CSS custom properties)
```
--primary:       #1B3A6E  (deep blue — nav, buttons, headers)
--primary-dark:  #0F2347
--primary-light: #2D5AA0
--gold:          #C8962A  (accent — badges, highlights, CTA)
--gold-light:    #E5B94E
--red:           #C0392B  (advocacy, alerts, errors)
--green:         #1a7340  (success states, Kenya green)
--text:          #1A202C
--text-muted:    #718096
--bg:            #F7F9FC
--bg-dark:       #0F1B2D  (footer, portal sidebar)
```

**Colour scheme (current):** deep-blue design system **except** the green banners — the
homepage `.hero`, every inner-page `.page-header`, and the **portal login pages**
(`.portal-login-page` in `portal.css`) use the green gradient
`linear-gradient(135deg, #00641C 0%, #008B23 55%, #1FB24A 100%)`. A full green/gold rebrand was tried and reverted on 22 June 2026
(commit `891027a`) — keep this green-banner / blue-rest split unless asked otherwise.

Portal-specific status badge classes (in `portal.css`):
`.status-badge--pending_approval`, `.status-badge--approved`, `.status-badge--rejected`,
`.status-badge--suspended`, `.status-badge--draft`, `.status-badge--submitted`,
`.status-badge--under_review`, `.status-badge--paid`
