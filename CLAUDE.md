# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env          # Fill in DB credentials + set JWT secrets
npm install                   # Install all dependencies
npm run init-db               # Create MySQL schema (21 tables) and seed data

# Development
npm run dev                   # Start with nodemon auto-reload (port 3000)
npm start                     # Production start

# Re-seed the database
mysql -u root -p < backend/config/init.sql
```

There are no tests or linting scripts configured yet.

---

## Project Status (as of 26 June 2026)

**GitHub repo:** https://github.com/Bravque/kuppet-migori  
**Owner:** Bravque (bravinowino008@gmail.com)  
**Live domain:** https://kuppetmigori.co.ke (Hostinger Business — auto-deploys from GitHub `main`) ✓ LIVE

### Hosting setup
- **Platform:** Hostinger Business shared hosting
- **Deployment:** GitHub auto-deploy (push to `main` → Hostinger rebuilds automatically)
- **Database:** MySQL on Hostinger — `u735599564_KuppetMigori44`, user `u735599564_Admin44Kuppet`
- **Schema:** imported via `backend/config/init-hostinger.sql` (no `CREATE DATABASE` line)
- **Env vars:** set in hPanel → Environment variables (imported from `env-kuppet.txt` on Desktop). **Must include `UPLOAD_DIR=/home/u735599564/uploads`** (see persistent-uploads note) and `CONTACT_EMAIL` (contact-form notifications).
- **SSH:** `ssh -p 65002 u735599564@92.113.28.102` — password set in hPanel → SSH Access (separate from hPanel login password). Interactive shell may be disabled (`/sbin/nologin`); if so use **SFTP** or **hPanel File Manager** instead. App lives in `~/nodejs/`, web root in `~/public_html/`; uploads in `~/uploads/` (outside both).
- **Persistent uploads:** runtime uploads live in `~/uploads/` (set via `UPLOAD_DIR`), **outside** the git-deployed `~/nodejs/` tree, so they survive redeploys. See the File uploads section.

### What is built and committed ✓

| Layer | Status |
|-------|--------|
| Express server + all REST API routes | ✓ Complete |
| MySQL schema (21 tables) + seed data | ✓ Complete |
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
| **Admin portal — 21 pages (all CRUD/actions wired)** | ✓ Complete |
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

### Done in the 1 July 2026 session

**Password reset link expiry 1h → 30 min**
- `memberAuthController.forgotPassword` reset JWT `expiresIn` `'1h' → '30m'`; email copy in `mailerService` updated to match ("expires in 30 minutes"). Still single-use (signed with `JWT_MEMBER_SECRET + member.password`). Backend-only, no DB/cache change.

**Stored-XSS fix — rich-text content sanitized on write**
- News + advocacy article **bodies are rendered raw as HTML** on the public site (`main.js` `.article-content` at ~L487/577) to preserve admin formatting — previously unsanitized, so a `<script>`/`<img onerror>` saved by an admin/branch_officer would execute for every visitor (CSP still allows `script-src 'unsafe-inline'`). Added **`sanitize-html`** dep + **`backend/utils/sanitizeHtml.js`** (`sanitizeRichText()`, allowlist: formatting/list/table/img/a tags, `http|https|mailto|tel` schemes only, safe inline styles, forces `rel="noopener noreferrer"`; strips `<script>/<iframe>`, all `on*` handlers, `javascript:` URLs). Applied on **create + update** in `newsController` + `advocacyController` (the two `content` fields rendered raw). Verified against 7 payloads.
  - **Note:** sanitization is **on write**, so pre-existing article rows aren't retroactively cleaned (none are known-malicious — admin-authored). If ever needed, re-save each article or run a one-time backfill through `sanitizeRichText`.
  - **Not touched (deferred, per scope):** app-layer validation on the other admin content routes (they rely on the DB schema → bad input yields a 500 not a clean 400, and text fields have no length cap), and dropping CSP `unsafe-inline`.

**Error-handling robustness — 3 edge-case fixes**
- **Unknown `/api/*` routes now return JSON 404.** Added `app.use('/api', …)` in `server.js` *before* the portal/SPA wildcards — previously an unknown API path fell through to the `app.get('*')` SPA fallback and returned `index.html` (HTML 200) for GET, or Express's default HTML 404 for POST/PUT/DELETE, breaking JSON clients. Verified: unknown GET/POST `/api/*` → `{success:false,message:'API route not found'}` 404; unknown page still serves the SPA HTML.
- **Public `api.js` guards the JSON parse** — `await res.json().catch(() => ({}))` (was unguarded, so a non-JSON body like a proxy 502/HTML page threw "Unexpected token <" and masked the real status). The admin/member portal wrappers already did this. → **api.js edited → cache token bumped `20260626d → 20260701a` across all 42 public HTML.**
- **Process-level backstop** — added `process.on('unhandledRejection')` + `'uncaughtException')` loggers in `server.js` (log-only, no force-exit, to avoid a restart loop on shared hosting) so a stray fire-and-forget rejection (e.g. `sendMail`/`sendSms`) is logged instead of crashing silently.

**Logging / monitoring / alerting — 3 additions (backend-only, no cache bump)**
- **Deep health check** — `/api/health` now runs `SELECT 1` and returns **503 `db:down`** on DB failure (was a false 200). Point an uptime monitor (UptimeRobot etc.) at it. Required adding `const db = require('./config/database')` to `server.js`.
- **Failed/forbidden attempts are now audited.** Refactored `middleware/auth.js`: new shared `recordAudit()` (never throws, uses the existing `audit_logs.new_value` JSON column — **no migration**). `auditLog` now records failures too (action gets a `.failed` suffix + `{status}` in new_value), and **`authorizeAdmin`/`authorizeSuperAdmin` log every 403** as `authz.denied` with `{required, role, method, path}` — surfaces privilege-escalation probing (a `branch_officer` hitting super-admin routes). Successful actions unchanged.
- **Email alerts on serious errors** — new `backend/services/alertService.js` (`sendErrorAlert`, **throttled to 1 email / 10 min**, fire-and-forget, never throws). Wired into the global 500 handler + both process handlers. Recipient: **`ALERT_EMAIL` → `CONTACT_EMAIL` → `SMTP_USER`** (added `ALERT_EMAIL` to `.env.example`; set it in hPanel to receive alerts). No-ops if SMTP/recipient unset.
  - **Deferred (per scope):** structured file logging (pino/winston + rotation + request IDs) — still raw `console.*` → Passenger stdout.

### Done in the 26 June 2026 session

**Notice Board (news) — Sport & Entertainment + media**
- New `sport_entertainment` category on `news.category` (public filter tabs + sidebar, admin create/edit form, gold badge). Articles now support a **2nd image** + a **downloadable document** — new columns `image_2`, `document_url`, `document_name`; admin modal gained image1/image2/document uploads (new public `news/` upload subdir + `newsMedia` multer instance with `.fields()`); the article page renders the gallery image + a download card. Admin news edit modal now **loads existing data** (was a stub) via new `GET /api/news/admin/:id`; create/update switched to FormData. → run `migration-news-media.sql` on live.

**Resources — clickable categories + Sport & Entertainment**
- **Fixed a dead feature:** the category cards never filtered — `initResourcesPage()` only wired non-existent `.filter-tab`s and the inline script dispatched a no-op event. Cards/tabs now share one handler, reload on click, and honour `?category=` deep links (with a guard for unknown categories). Added a **Sports & Entertainment** resource category (card, `resources.category` ENUM, admin form). → run `migration-resources-category.sql` on live.

**Persistent uploads (fixes vanishing leader photos)**
- Admin-uploaded files were wiped on every deploy (git-ignored `public/uploads/`, restored from git on redeploy). Centralised the upload root in **`backend/config/paths.js`**, configurable via **`UPLOAD_DIR`** (absolute path outside the deployed tree; falls back to `./public/uploads` locally). `server.js` serves `/uploads` from it and returns a real **404 JSON** for missing files (was silently serving `index.html`, breaking `<img>`s); `renderLeaderCard` gained an `onerror` icon fallback. **Live setup:** created `~/uploads/{photos,documents,news,members,bbf,scholarships}` and set `UPLOAD_DIR=/home/u735599564/uploads` in hPanel. (Photos uploaded before this are unrecoverable unless a pre-deploy Hostinger backup exists.)

**Contact form — staff notification + admin reply**
- On submit, emails the branch inbox (`CONTACT_EMAIL` → falls back to `SMTP_USER`, reply-to = enquirer) + auto-acknowledges the enquirer. New **`POST /api/contact/:id/reply`** (admin, validated, audit-logged) emails the enquirer, stores `admin_reply` + `replied_at`, marks `replied`; Contact Inbox gained a **Reply** button + modal. `mailerService.sendMail` gained `replyTo`; new `contactStaffAlert`/`contactReply` templates; contact email values HTML-escaped. → run `migration-contact-reply.sql` on live.

**Mobile — card grids scroll horizontally**
- New reusable **`.h-scroll`** utility (style.css): at ≤640px, card grids become horizontal scroll-snap rows (cards `clamp(220px,82%,300px)` so the next peeks) instead of long vertical stacks. Applied to news/featured-news/leadership/scholarships/advocacy/resource-categories/home-services/about-values+group-photos. Homepage featured-news wrapped in `.news-grid` (also fixes its desktop 3-up). Fixed news-page overflow this exposed: `.news-layout` tracks → `minmax(0,1fr)`. Verified in headless Chrome at 390px: all rows scroll, zero page overflow.

**Cache token** — `20260622b → 20260626c` across all 42 public HTML (bumped per style.css/main.js edits). Portal JS (`admin/js/*`, `member/js/*`) still unversioned — hard-refresh after portal-JS edits (contact Reply button, admin news/resources changes live there).

### Done in the 22 June 2026 session (security audit + hardening, branding, deps)

A full security audit was run against the codebase and **all findings fixed** (committed to `main`, deployed). Highlights:

**Critical**
- **Sensitive uploads no longer publicly downloadable.** `server.js` now 404-blocks `/uploads/{members,bbf,scholarships}` *before* `express.static`, so National IDs / passport scans / claim docs can't be fetched directly. Members stream their own files via `GET /api/member/documents/:filename` (ownership-checked); admins use the **new** `GET /api/admin/documents/:filename` (`backend/routes/adminDocuments.js`, auth+admin). Admin detail pages (`bbf-detail`, `scholarship-app-detail`, `member-detail`) now open docs through a `viewDoc()` blob-fetch helper in `admin-portal.js` instead of direct `<a href>` links. (`photos/` + `documents/` stay public — leader photos, resource downloads.)
- **No more default admin credential.** `init*.sql` now seeds the admin **inactive with an unusable hash (`'!'`)**; the published `Admin@123` was removed from this file. Set a real password + `is_active=1` per the reset procedure above.

**High**
- **TOTP key guard** — `server.js` refuses to boot unless `TOTP_ENCRYPTION_KEY` is 64 random hex (was an all-zero fallback). Removed the zero default from `.env.example`.
- **Dependencies** — removed `xlsx` (high, no-fix) → exports migrated to **`exceljs`** via `backend/utils/excel.js`; **nodemailer → 9.x**; added **`express-async-errors`** (rejected async handlers now reach the error handler). Later (Hostinger CVE email): **multer → 2.x** (7 DoS CVEs) and a **`uuid` override → ^11.1.1** (exceljs transitive). `npm audit`: **0 vulnerabilities**.

**Medium/Low**
- **CSRF is now actually enforced** (it was previously dead code). `csrfProtection` is applied to `/api/member` + `/api/admin`; `issueCsrfCookie` moved to run **globally before static serving** so portal HTML always carries the `__csrf` cookie. Both API wrappers already send `X-CSRF-Token`.
- Stripped internal `err.message` from all 500 responses (log server-side only); `.gitignore` now covers `.env*` (keep `.env.example`); `FRONTEND_URL` asserted in production; added `Permissions-Policy` + explicit 2-yr HSTS preload; `morgan('combined')` in prod; traversal-guard on the catch-all `sendFile`; password complexity (≥8 + letter + number) on member/admin password set.

> **Deferred (breaking, not done):** moving JWTs from `localStorage` → `httpOnly` cookies, and dropping CSP `script-src 'unsafe-inline'` (would require refactoring inline handlers incl. the new `viewDoc` `onclick`s).

**Branding / assets**
- **Login pages** (`member/login.html`, `admin/login.html`) — background changed blue → **green** (the logo-green banner gradient); logo no longer crammed in a gold box — now a clean white badge (`88px`, `.login-logo-icon .logo-img` in `portal.css`). Fixed a stray `</i>` in admin login.
- **Favicon** added across **all 42 pages** — `favicon.ico` (16/32/48), `favicon-16/32`, `apple-touch-icon` (180), generated from the **emblem crop** of the logo (full-logo text is illegible at 16–32px). Source: owner-supplied `kuppetfavicon.png`. Files at `public/favicon.ico`, `public/apple-touch-icon.png`, `public/images/favicon-*.png`.
- **Image compression** — `kuppetlogo.png` 532KB→24KB (320px palette PNG); `leaders/henri-otunga.jpg` 642KB→28KB (600px mozjpeg). Done with `sharp` (installed `--no-save`, not a project dep).
- **Cache token bumped `20260622a → 20260622b`** across all public HTML (portal.css changed).

### Done in the 21 June 2026 session
- **Article detail pages** — new `public/pages/article.html` (`article-page` body class) reads `?slug=` → `api.news.getOne` and `public/pages/advocacy-article.html` (`advocacy-article-page`) → `api.advocacy.getOne`. Added `initArticlePage()` + `initAdvocacyArticlePage()` to `main.js`; repointed both "Read More" links to these pages; `api.js` now attaches `err.status` for 404 handling. (Backend `GET /api/news/:slug` & `/api/advocacy/:slug` already existed.)
- **Schema phone fix** — `index.html` schema.org `contactPoint.telephone` set to the real `+254-721-808-993`.
- **About page** — added **Leadership in Pictures** section (`#group-photos`) with 3 group-photo cards (Branch Executive Committee, Branch Governing Council, Welfare Steering Committee); each `<img>` falls back to a "coming soon" placeholder via `onerror`. Photos go in `public/images/groups/` with exact filenames `branch-executive-committee.jpg`, `branch-governing-council.jpg`, `welfare-steering-committee.jpg` (see README there).
- **Mission & Vision** — set sitewide (homepage mission strip + About cards). Mission: "To be a leading branch in effectively representing, protecting and advancing the professional, economic, and social interests of members through transparent governance, institutional strengthening, capacity development and innovative service delivery to secondary teachers in Migori." Vision: "To be a model branch of excellence in Advocacy, Leadership and offering Service with Distinction."
- **Org structure rebuilt** (About page) — 5 levels: KUPPET National Executive Board → National Governing Council → Branch Executive Committee → Branch Governing Council → Sub-Counties (12).
- **Sub-counties 7 → 12** — updated everywhere: About history/org chart, Contact page (12 sub-branch cards + "all 12" count), and the sub-county dropdowns in `member/register.html`, `member/profile.html`, `admin/members.html`, `admin/sms.html`.
- **BBF claims restructured** (see Database schema + the BBF feature notes below) — two claim types only (`death`, `retirement`); claim-particular fields added; school category moved to the member profile (captured at registration). Run `backend/config/migration-bbf-claim-fields.sql` on the live DB.
- **Scholarship types reduced to three** — `kcse | kjsea | dte` (DTE = Diploma in Technical Education), replacing the old undergraduate/postgraduate/etc. Updated schema + seed (both `init*.sql`), `scholarshipsController` (default `kcse` + validation), the public scholarships filter tabs + type badge (`scholarshipTypeLabel()` in `main.js`). The same migration file (step 4) remaps existing rows on the live DB. (The admin scholarship create/edit form is now built — see "Admin panel completed" below.)
- **Scholarships reframed** — they sponsor **teacher members to further their own studies** (not children/dependants); copy updated on `scholarships.html` + homepage.
- **Member login by TSC number** — members now sign in with **TSC number + password** (was email). `memberAuthController.login` looks up by `tsc_number` (accepts legacy `email` key as a cache shim); login form + `member-api` updated. Email is still collected at registration (kept unique) but is no longer the login identifier. Admin login still uses email.
- **Forgot / reset password (members)** — `forgot-password.html` + `reset-password.html`; routes `POST /api/member/auth/forgot-password` (rate-limited 5/hr) & `/reset-password`. Reset token is a JWT signed with `JWT_MEMBER_SECRET + member.password` → single-use & self-expiring (1h), no DB column. Delivered by email → **requires SMTP env vars** (`SMTP_HOST/PORT/USER/PASS`); `APP_URL` builds the link. `backend/scripts/test-email.js you@x.com` checks SMTP. ✓ SMTP confirmed working on live.
- **Leadership roster** — replaced placeholder leaders with the 14 real officials (`update-leadership.sql` for the live DB; seeded in `init*.sql`). About page: 3 **Principal Officials** (Chairman, Exec Sec, Treasurer) in their own row, then **Other Branch Officials**; Trustees section removed. Cards show photo + position + name + click-to-call phone + email icon (no bio). Phones E.164; placeholder email `info@kuppetmigori.co.ke` on all (owner to replace). Leader photo CSS → `object-fit:contain` (full image centered, not cropped).
- **BBF claim detail split** — member + admin claim pages show **Claim / Applicant's Details / Deceased Person Details** as separate blocks (`memberBbfController.getOne` now returns `applicant_name`).
- **Inner-page banner → logo-green gradient** — `.page-header` now `#00641C → #008B23 → #1FB24A` (the logo green) on **all** inner pages incl. Advocacy (homepage hero greened too — see below).
- **Uploads** — profile photo uses a new image-only `memberPhoto` multer filter (JPEG/PNG/WebP, no PDF); `.jpg/.jpeg` extensions added to every `accept` for clearer file pickers.
- **Admin panel completed** — built the 7 previously broken/stub pages: `scholarship-app-detail` (review/approve/reject), content CRUD for **leadership/resources/advocacy/scholarships** (modals; leadership photo + resource file uploads via FormData), `sms-templates` (create/edit/deactivate), `sms-logs` (filter + pagination). BBF + member approve/reject/etc. upgraded from `prompt()` to inline modals (also fixed BBF action buttons that were bound to an unreachable IIFE-scoped function). **Authenticated exports** — added a blob-download helper in `admin-api.js` (members/BBF/analytics/audit); `window.open()` exports were failing with "Access token required" because they couldn't send the Bearer header.
- **Homepage hero → green gradient** too (matches the inner-page banners).
- **SMS / TalkSasa** — fixed the integration to the **v3 API** (correct endpoint + `{recipient,sender_id,type,message}`); built the **delivery webhook** (`/api/sms/webhook`) and `test-sms.js`/`test-email.js` diagnostics. SMTP (Hostinger mailbox) confirmed working. SMS delivery is blocked on **TalkSasa sender-ID network registration** (see Task 5) — code is complete.
- **Green/gold rebrand tried & reverted (22 June 2026)** — a full logo-colour rebrand (`eb23842`, `700b0a9`) was reverted (`891027a`) per owner preference. Final scheme: **green hero + inner-page banners, deep-blue everything else.**
- **Cache token** — now `20260622b` across all public HTML (bumped several times for `style.css`/`main.js`/`api.js` edits). NOTE: portal JS (`member/js/*`, `admin/js/*`) is **unversioned** — after editing it, hard-refresh; consider adding `?v=` to those `<script>` tags if stale-cache issues appear.

### Done in the 17 June 2026 session
- **Responsive overhaul** — eliminated horizontal overflow on every public page across 320–1920px (Playwright-audited). Root-cause fixes only (no `overflow:hidden` masking): header compression `≤1780px`, icon-only CTA `≤1300px`, inline nav collapses to the hamburger **drawer at `≤960px`**, `.search-bar`/inputs `min-width:0`, `.btn { max-width:100% }`, advocacy form grid → `minmax(0,1fr)`.
- **Header standardized** — all 6 public pages share the **exact** topbar + header markup (only the active nav item differs). Restored the **Get Help** button (header CTA on desktop; inside the mobile drawer via `.nav-cta`).
- **Portal sidebar scroll fixed** — `.portal-sidebar { height:100vh; overflow:hidden }`, only `.sidebar-nav { flex:1; min-height:0; overflow-y:auto }` scrolls (admin + member).
- **Theme** — reverted the brief green experiment back to the deep-blue palette (see Design tokens).
- **Real content wired in** — official address (Cosade Building…, P.O. Box 842-40400), single email `info@kuppetmigori.co.ke` sitewide, WhatsApp channel as the only social link (with "follow for instant updates" copy), Google Maps `<iframe>` embed on contact page.

### Remaining tasks (pick up here next session)

**Task 1 — Article detail pages** — ✓ DONE (21 June 2026).

**⚠ Pending DB scripts (run once on the live DB via phpMyAdmin → SQL tab)**
1. `backend/config/migration-bbf-claim-fields.sql` — (a) restructures `bbf_claims` to the two-type model + claim-particular columns, (b) adds `members.school_category`, (c) remaps `scholarships.scholarship_type` to kcse/kjsea/dte. Until run, member registration + BBF/scholarship features fail on production.
2. `backend/config/update-leadership.sql` — clears placeholder leaders and inserts the 14 real officials. Until run, the About page shows the old placeholder names.
3. `backend/config/migration-news-media.sql` — adds the `sport_entertainment` category to `news.category` and three media columns (`image_2`, `document_url`, `document_name`). Until run, creating/saving Notice Board articles fails on production.
4. `backend/config/migration-resources-category.sql` — adds `sport_entertainment` to the `resources.category` ENUM. Until run, saving a resource under the new Sports & Entertainment category fails on production.
5. `backend/config/migration-contact-reply.sql` — adds `contacts.admin_reply` + `contacts.replied_at`. Until run, the admin Contact Inbox **Reply** action fails (the email still sends, but recording the reply errors).

Fresh installs already include all of this via `init.sql` / `init-hostinger.sql`.

**Task 3 — Real content (owner must supply)**
Still placeholder in the codebase:
- Leadership group photos → upload to `public/images/groups/` (3 files, exact names — see About session note)
- Other leader photos → upload to `public/images/leaders/` (only `henri-otunga.jpg` exists), update `photo_url` in DB via admin portal
- Real sub-county representative phone numbers (all 12 sub-counties currently reuse the main number)
- DONE: ✓ address ✓ email ✓ social links (WhatsApp) ✓ Google Maps embed ✓ schema.org telephone ✓ mission/vision ✓ org structure

**Task 4 — SEO files**
- `public/sitemap.xml` — all public pages
- `public/robots.txt` — allow all, point to sitemap
- Branded `og:image` 1200×630 px, add `<meta property="og:image">` to all pages
- Add canonical and full `og:url` tags to inner pages

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
- **`backend/config/init.sql`** — authoritative schema (21 tables) + seed data; re-runnable
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
- **`admin/js/admin-portal.js`** — auth guard, sidebar init, page `init*()` functions, Chart.js integration
- 21 HTML pages — each uses `getSidebarHtml()` + `getTopbarHtml()` injected at runtime

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
Hostinger serves CSS/JS with **no `cache-control`/`etag`**, so browsers hold stale assets after a deploy. Public CSS/JS links carry a version query, e.g. `href="/css/style.css?v=20260622b"`. **When you edit `style.css`, `portal.css`, `main.js`, or `api.js`, bump the `?v=` string on every page** (sed across `public/**/*.html`) or returning visitors won't see the change. HTML files themselves aren't versioned (they revalidate). Current token: `20260701a`.
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
| `branch_officer` | Can review/recommend; cannot delete admins, change system settings, or access audit logs |

Middleware: `authorizeAdmin` allows both roles. `authorizeSuperAdmin` allows only `super_admin`. `branch_officer` is blocked from every `authorizeSuperAdmin` route: approving BBF claims / marking paid, approving scholarship apps, suspending/deleting members, admin-user management, settings, audit logs, exports, bulk/group SMS, 2FA disable.

> ⚠ The `users.role` ENUM also has `editor` and `viewer`, but **no route grants them access** — `authorizeAdmin` rejects anything that isn't `super_admin`/`branch_officer`, so an editor/viewer gets 403 everywhere. They're dead roles; the user-create form still offers them (assigning one creates a useless account). Drop them from the dropdown/ENUM or wire real permissions before using them.

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

### Email (SMTP) — required for password reset & notification emails
`backend/services/mailerService.js` sends via nodemailer when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are set (else it logs & skips). `sendMail()` supports an optional `replyTo`. `APP_URL` (e.g. `https://kuppetmigori.co.ke`) is used to build links in emails (password reset). Live uses the Hostinger mailbox for `info@kuppetmigori.co.ke` (`smtp.hostinger.com:465`). Test with `node backend/scripts/test-email.js you@example.com`.

**Contact form (26 June 2026):** on submit the controller emails the branch inbox (`CONTACT_EMAIL`, falls back to `SMTP_USER`; reply-to = enquirer) and auto-acknowledges the enquirer. Admins reply from the Contact Inbox via `POST /api/contact/:id/reply` (emails the enquirer, stores `admin_reply`/`replied_at`, marks `replied`). All fail gracefully if SMTP is unconfigured.

### Database schema (21 tables)
**Core (public site):** `users`, `leadership`, `news`, `events`, `resources`, `scholarships`, `advocacy`, `contacts`, `settings`

**Membership:** `members`, `bbf_claims`, `bbf_claim_documents`, `bbf_claim_timeline`, `scholarship_applications`, `scholarship_application_documents`, `notifications`

**SMS & comms:** `sms_logs`, `sms_templates`

**Security & audit:** `audit_logs`, `login_history`, `admin_2fa`

Key ENUM values:
- `users.role`: `super_admin | branch_officer | editor | viewer`
- `members.status`: `pending_approval | approved | rejected | suspended`
- `members.gender`: `male | female | other`
- `members.school_category`: `senior_school | junior_school` (nullable; captured at registration, editable in profile)
- `bbf_claims.status`: `draft | submitted | under_review | approved | rejected | paid`
- `bbf_claims.claim_type`: `death | retirement` (was `death_benefit/disability/medical_emergency/other` before 21 June 2026)
- `bbf_claims.school_category`: `senior_school | junior_school`
- `scholarships.scholarship_type`: `kcse | kjsea | dte` (was `undergraduate/postgraduate/vocational/research/international` before 21 June 2026; DTE = Diploma in Technical Education)
- `scholarship_applications.status`: `applied | under_review | approved | rejected`
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
Files are stored under the upload root with UUID filenames (multer **2.x**), in subdirs `photos/`, `documents/`, `bbf/`, `scholarships/`, `members/`, `news/`. The sensitive subdirs — `members/`, `bbf/`, `scholarships/` — are **404-blocked from static serving** in `server.js` (before the `/uploads` static); only `photos/`, `documents/`, `news/` are public. Sensitive files are streamed only through ownership/role-checked endpoints:
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
