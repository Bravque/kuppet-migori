# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env          # Fill in DB credentials + set JWT secrets
npm install                   # Install all dependencies
npm run init-db               # Create MySQL schema (25 tables) and seed data

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
| MySQL schema (25 tables) + seed data | ✓ Complete |
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
| **Admin portal — 24 pages (all CRUD/actions wired)** | ✓ Complete |
| **Court cases tracker (branch officers) — list, detail, updates log, dashboard summary** | ✓ Complete |
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

**✓ DB migrations — all applied on live (3 July 2026)**
The following one-time scripts have been run on the live Hostinger DB; no pending DB migrations remain. Fresh installs already include all of this via `init.sql` / `init-hostinger.sql`. (Kept for reference / re-provisioning a new environment.)
1. `backend/config/migration-bbf-claim-fields.sql` — two-type `bbf_claims` model + claim-particular columns, `members.school_category`, remaps `scholarships.scholarship_type` to kcse/kjsea/dte.
2. `backend/config/update-leadership.sql` — clears placeholder leaders, inserts the 14 real officials.
3. `backend/config/migration-news-media.sql` — `sport_entertainment` category on `news.category` + `image_2`/`document_url`/`document_name`.
4. `backend/config/migration-resources-category.sql` — `sport_entertainment` on `resources.category`.
5. `backend/config/migration-contact-reply.sql` — `contacts.admin_reply` + `contacts.replied_at`.
6. `backend/config/migration-scholarship-doc-types.sql` — `letter_of_application` + `tsc_slip` on `scholarship_application_documents.doc_type`.
7. `backend/config/migration-court-cases.sql` — `court_cases` + `court_case_updates`.
8. `backend/config/migration-court-case-documents.sql` — `court_case_documents`.
9. `backend/config/migration-announcements.sql` — `announcements` table (homepage ticker) + seeds the 5 previously-hardcoded items. Applied on live 9 July 2026.
10. `backend/config/migration-drop-dead-roles.sql` — prunes the unused `editor`/`viewer` roles from `users.role` (reassigns any such rows → branch_officer, contracts ENUM to `super_admin`/`branch_officer`). **⚠ Run once on the live Hostinger DB** (phpMyAdmin → SQL). *Superseded by #11 — you can skip this and run #11 instead.*
11. `backend/config/migration-add-branch-secretary.sql` — adds the `branch_secretary` role (ENUM → `super_admin`/`branch_officer`/`branch_secretary`); self-contained (also reassigns any leftover editor/viewer). **⚠ Run once on the live Hostinger DB** (phpMyAdmin → SQL).
12. `backend/config/migration-member-import.sql` — bulk-member-import support: relaxes NOT NULL on `phone`/`email`/`gender`/`date_of_birth`/`school_name`/`sub_county` (fill-later), adds `members.must_change_password` + `members.onboarding_complete`. **⚠ Run once on the live Hostinger DB BEFORE deploying the first-login/onboarding code or importing** (the login/getMe queries read the new columns). See the bulk-import flow below.

**Task 3 — Real content (owner must supply)**
Still placeholder in the codebase:
- Leadership group photos → upload to `public/images/groups/` (3 files, exact names — see About session note)
- Other leader photos → upload to `public/images/leaders/` (only `henri-otunga.jpg` exists), update `photo_url` in DB via admin portal
- Real sub-county representative phone numbers (all 12 sub-counties currently reuse the main number)
- DONE: ✓ address ✓ email ✓ social links (WhatsApp) ✓ Google Maps embed ✓ schema.org telephone ✓ mission/vision ✓ org structure

**Task 4 — SEO files**
- ✓ `public/sitemap.xml` — 7 public pages (home + about/news/resources/advocacy/scholarships/contact); article templates excluded (need `?slug=`). Referenced by `robots.txt`. (14 July 2026)
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
- **`backend/config/init.sql`** — authoritative schema (25 tables) + seed data; re-runnable
- **`backend/controllers/*.js`** — async functions; parameterised queries; `{ success, data, message }` responses
- **`backend/routes/*.js`** — thin routers with `express-validator` on mutation routes
- **`backend/middleware/auth.js`** — `authenticate` (admin JWT), `authenticateMember` (member JWT), `authorizeAdmin`, `authorizeSuperAdmin`, `auditLog(action)` factory
- **`backend/middleware/csrf.js`** — double-submit cookie CSRF protection
- **`backend/middleware/upload.js`** — multer instances: `photo`, `document`, `bbfDocs`, `scholarshipDocs`, `memberDocs`
- **`backend/services/smsService.js`** — TalkSasa wrapper; `sendSms()`, `sendBulk()`; always logs to `sms_logs`; never throws
- **`backend/services/notificationService.js`** — `createNotification()` inserts into `notifications` + optionally triggers SMS
- **`backend/services/mailerService.js`** — nodemailer wrapper with email templates; fails gracefully

### Frontend layout

**Public site:**
- **`public/js/api.js`** — `window.api` with namespaced methods
- **`public/js/main.js`** — body-class guards, `DOMContentLoaded`, `escHtml()`, render helpers

**Admin portal (`/public/admin/`):**
- **`admin/js/admin-api.js`** — `window.adminApi`; injects `adminToken` from localStorage; 401 → redirect to login
- **`admin/js/admin-portal.js`** — auth guard, sidebar init, page `init*()` functions, Chart.js integration, and the shared **`renderAdminPager(elId, {total, offset, limit, onPage})`** helper (a "N–M of T" + Prev/Next pager; each list page has a `<div id="…-pager">` and calls it after rendering rows, resetting `offset` to 0 when a filter changes). List controllers return `total` for this. SMS Logs uses its own inline pager.
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
Hostinger serves CSS/JS with **no `cache-control`/`etag`**, so browsers hold stale assets after a deploy. Public CSS/JS links carry a version query, e.g. `href="/css/style.css?v=20260622b"`. **When you edit `style.css`, `portal.css`, `main.js`, or `api.js`, bump the `?v=` string on every page** (sed across `public/**/*.html`) or returning visitors won't see the change. HTML files themselves aren't versioned (they revalidate). Current token: `20260709a` (bumped 9 July 2026 for the announcements-ticker `main.js`/`api.js` changes).
> ⚠ Caveat: portal JS (`member/js/member-portal.js`, `member/js/member-api.js`, `admin/js/admin-portal.js`, `admin/js/admin-api.js`) is loaded **without** a `?v=` query, so the convention above does not cover it. Editing those files relies on browser revalidation — hard-refresh after deploying portal-JS changes (e.g. member TSC login + admin export fixes live there); if stale-cache issues appear, add a `?v=` to those `<script>` tags.

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

Middleware: `authorizeAdmin` allows all three roles (the `ADMIN_ROLES` list in `auth.js`). `authorizeSuperAdmin` allows only `super_admin`. `authorizeRoles(...roles)` is a factory that allows `super_admin` plus the listed roles (used as `authorizeRoles('branch_officer')` for court-cases and for all decision routes below). `branch_officer` and `branch_secretary` are blocked from every `authorizeSuperAdmin` route: admin-user management, settings, audit logs, 2FA disable. (The **dashboard "Export Report" analytics PDF** — `GET /api/admin/analytics/export-pdf` — is available to **all** admin roles as of 10 July 2026. The **member & BBF Excel exports** — `GET /api/admin/members/export` and `/api/admin/bbf/export` — are also available to **all** admin roles as of 12 July 2026; they were `authorizeSuperAdmin` before.) **All Communications features are open to every admin role as of 13 July 2026** — SMS send/bulk/group + templates create/update (`adminSms.js`) and Email send/bulk/group (`adminEmail.js`) are all `authorizeAdmin`; bulk/group SMS and template editing were `authorizeSuperAdmin` before.

**Member/application decisions → branch_officer + super_admin (10 July 2026).** Restricted via `authorizeDecision = authorizeRoles('branch_officer')`: member approve/reject/suspend/delete (`adminMembers.js`), BBF claim approve/reject/mark-paid (`adminBbf.js`), scholarship-app approve/reject (`adminScholarshipApps.js`). `branch_secretary` can **view/print** these and **start BBF review** (`/:id/review` stays `authorizeAdmin`) but cannot make final decisions. The detail/list pages compute `canDecide = role ∈ {super_admin, branch_officer}` and hide the approve/reject/suspend/mark-paid buttons for others (member-detail, members, bbf-detail, scholarship-app-detail); the backend gate enforces it regardless.

Additionally, `branch_secretary` is blocked from the Legal / Court Cases routes (see the Legal schema note). The sidebar hides `data-super-only` items for any non-super role, and `data-court-only` items for any role outside {`super_admin`,`branch_officer`} (cosmetic; the backend gate enforces it).

> The old unused `editor`/`viewer` roles were pruned (9 July 2026). `users.role` is now `super_admin | branch_officer | branch_secretary` (default `branch_officer`); the dropdown and validators offer only these. To add a role with a *different* permission set (not a peer), wire real per-capability permissions in the auth middleware rather than a role with no route access.

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

**Contact form (26 June 2026):** on submit the controller emails the branch inbox (`CONTACT_EMAIL`, falls back to `SMTP_USER`; reply-to = enquirer) and auto-acknowledges the enquirer. **Advocacy-category** enquiries route to `ADVOCACY_EMAIL` (`advocacy@kuppetmigori.co.ke`) instead. Admins reply from the Contact Inbox via `POST /api/contact/:id/reply` (emails the enquirer, stores `admin_reply`/`replied_at`, marks `replied`). All fail gracefully if SMTP is unconfigured.

**Advocacy reports access (10 July 2026):** contacts with `category = 'advocacy'` (the Advocacy Desk issue reports) are restricted to `branch_officer` + `super_admin`; `branch_secretary` is excluded. `contactController` filters advocacy rows out of the admin list/count and returns 403 on reply/restatus of an advocacy contact for non-advocacy roles (`canViewAdvocacy`); the Contact Inbox hides the `[data-advocacy-only]` "Advocacy Reports" filter chip for them. **Advocacy replies are sent from advocacy@** — `POST /api/contact/:id/reply` sets both `from` and `replyTo` to `ADVOCACY_EMAIL` for advocacy-category enquiries (via the new optional `from` param on `mailerService.sendMail`), sent over the existing SMTP login.

> ⚠ **Rate-limit scoping (10 July 2026):** `contactLimiter` (5/hr) is now applied only to `POST /api/contact` (the public form) — previously `app.use('/api/contact', contactLimiter)` covered the whole path, so admins loading the Contact Inbox (`GET /api/contact`) a handful of times hit the limit and saw the public "Too many contact submissions" message. The admin reads/replies/status are no longer rate-limited by it.

### Database schema (25 tables)
**Core (public site):** `users`, `leadership`, `news`, `events`, `resources`, `scholarships`, `advocacy`, `contacts`, `settings`, `announcements`

> `announcements` — the homepage scrolling ticker items (`text`, optional `link`, `sort_order`, `is_active`). Public `GET /api/announcements` returns active items in order; admin CRUD at `POST/PUT/DELETE /api/announcements` (both roles) via the **Ticker Announcements** content page (`content-announcements.html`). The homepage renders them in `main.js` `loadAnnouncements()` (items duplicated for the -50% CSS marquee loop); if the list is empty the ticker bar hides, and static fallback markup in `index.html` shows if the fetch fails.

**Membership:** `members`, `bbf_claims`, `bbf_claim_documents`, `bbf_claim_timeline`, `scholarship_applications`, `scholarship_application_documents`, `notifications`

**SMS & comms:** `sms_logs`, `sms_templates`

**Security & audit:** `audit_logs`, `login_history`, `admin_2fa`

**Legal:** `court_cases`, `court_case_updates`, `court_case_documents` (court-case tracker for branch officers; shared branch-wide, each case has a responsible `officer_id`, a dated updates/hearings log, and file attachments. Attachments live in the access-controlled `court/` upload dir, 404-blocked from static and served only via `GET /api/admin/documents/:filename` — its ownership UNION includes `court_case_documents`. Admin API at `/api/admin/court-cases`; pages `court-cases.html` + `court-case-detail.html`; dashboard summary via `getStats`. **Access restricted to `branch_officer` + `super_admin`** via `authorizeRoles('branch_officer')` in `courtCases.js`; `branch_secretary` is excluded — the shared `/api/admin/documents/:filename` endpoint also drops the `court_case_documents` UNION branch for non-court roles, and the sidebar/dashboard `[data-court-only]` items are hidden from them.)

Key ENUM values:
- `users.role`: `super_admin | branch_officer | branch_secretary` (default `branch_officer`)
- `members.status`: `pending_approval | approved | rejected | suspended`
- `members.gender`: `male | female | other`
- `members.school_category`: `senior_school | junior_school` (nullable; captured at registration, editable in profile)
- `bbf_claims.status`: `draft | submitted | under_review | approved | rejected | paid`
- `bbf_claims.claim_type`: `death | retirement` (was `death_benefit/disability/medical_emergency/other` before 21 June 2026)
- `bbf_claims.school_category`: `senior_school | junior_school`
- `scholarships.scholarship_type`: `kcse | kjsea | dte` (was `undergraduate/postgraduate/vocational/research/international` before 21 June 2026; DTE = Diploma in Technical Education)
- `scholarship_applications.status`: `applied | under_review | approved | rejected`
- `scholarship_application_documents.doc_type`: `letter_of_application | tsc_slip | kcse_cert | admission_letter | fee_structure | recommendation | other` (the first two are the mandatory member uploads added 3 July 2026)
- `court_cases.case_type`: `employment | disciplinary | criminal | civil | constitutional | appeal | other`
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

The new-claim form (`member/bbf-claims.html`) shows the member's identity in a read-only "Your details (from your profile)" box; the member only chooses type + (for death) deceased name/relationship/date of death. Required upload documents are unchanged (TSC Slip, Burial Permit, Letter from Principal; optional Birth Notification) and still apply to both types.

### Sequence number generation (atomic)
Member numbers (`MBR-YYYY-NNNNNN`), BBF claim numbers (`BBF-YYYY-NNNNNN`), and scholarship application numbers (`SAPP-YYYY-NNNNNN`) use atomic MySQL counters stored in the `settings` table (`member_seq`, `bbf_seq`, `schapp_seq`). Never use `COUNT(*)+1`.

### File uploads
Files are stored under the upload root with UUID filenames (multer **2.x**), in subdirs `photos/`, `documents/`, `bbf/`, `scholarships/`, `members/`, `news/`, `court/`. The sensitive subdirs — `members/`, `bbf/`, `scholarships/`, `court/` — are **404-blocked from static serving** in `server.js` (before the `/uploads` static); only `photos/`, `documents/`, `news/` are public. Sensitive files are streamed only through ownership/role-checked endpoints:
- **Members:** `GET /api/member/documents/:filename` — verifies the file belongs to the logged-in member.
- **Admins:** `GET /api/admin/documents/:filename` (`backend/routes/adminDocuments.js`) — `authenticate` + `authorizeAdmin`; admin detail pages fetch these as a blob via `viewDoc()` in `admin-portal.js` (a plain link can't send the Bearer token).

DB stores URL paths (`/uploads/<sub>/<file>`); these are served from the filesystem **upload root** at request time. A missing `/uploads/*` file now returns a real **404 JSON** (not the SPA `index.html`), so broken `<img>`s fail fast and hit their `onerror` fallback.

**⚠ Uploads must live OUTSIDE the git-deployed tree (persistent dir).** `public/uploads/` is git-ignored, and Hostinger's GitHub auto-deploy **restores the working tree on every deploy → all runtime uploads are wiped** (this is what blanked the admin-uploaded leader photos on 25 June). The upload root is centralised in `backend/config/paths.js` and configurable via the **`UPLOAD_DIR`** env var:
- Local dev: leave `UPLOAD_DIR` unset → falls back to `./public/uploads`.
- **Live (Hostinger): set `UPLOAD_DIR` to an absolute path above `public_html`** (e.g. `/home/u735599564/uploads`), create that dir once via SSH (`mkdir -p`), and the app reads/writes/serves there so files survive redeploys. Set it in hPanel → Environment variables.
- Lost files (uploaded before the persistent dir was configured) are only recoverable from a Hostinger backup snapshot taken **before** the wiping deploy; otherwise re-upload.

### Rate limiting
| Endpoint | Limit |
|----------|-------|
| All `/api/*` | 200 req / 15 min |
| `POST /api/contact` | 5 req / hr |
| `POST /api/auth/login` | 20 req / 15 min |
| `POST /api/member/auth/login` | 20 req / 15 min |
| `POST /api/member/auth/register` | 3 req / hr |
| `POST /api/member/auth/forgot-password` | 5 req / hr |
| `POST /api/admin/sms/send` | 20 req / min |
| `POST /api/admin/sms/bulk` | 3 req / hr |

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
