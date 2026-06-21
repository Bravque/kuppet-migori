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

## Project Status (as of 21 June 2026)

**GitHub repo:** https://github.com/Bravque/kuppet-migori  
**Owner:** Bravque (bravinowino008@gmail.com)  
**Live domain:** https://kuppetmigori.co.ke (Hostinger Business — auto-deploys from GitHub `main`) ✓ LIVE

### Hosting setup
- **Platform:** Hostinger Business shared hosting
- **Deployment:** GitHub auto-deploy (push to `main` → Hostinger rebuilds automatically)
- **Database:** MySQL on Hostinger — `u735599564_KuppetMigori44`, user `u735599564_Admin44Kuppet`
- **Schema:** imported via `backend/config/init-hostinger.sql` (no `CREATE DATABASE` line)
- **Env vars:** set in hPanel → Environment variables (imported from `env-kuppet.txt` on Desktop)
- **SSH:** `ssh -p 65002 u735599564@92.113.28.102` — password set in hPanel → SSH Access (separate from hPanel login password)

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

**If locked out or password unknown — reset via phpMyAdmin:**
1. hPanel → Databases → phpMyAdmin → `u735599564_KuppetMigori44` → SQL tab
2. Run:
```sql
UPDATE users
SET password = '$2a$10$Q5k3rg.2bJrNPs7k4UpT8OHR5HdqW.OmOOQ/t6.QfCXf0EVIz3som',
    failed_login_attempts = 0,
    locked_until = NULL
WHERE id = 1;
```
3. This sets the password to `Admin@123`. Change it immediately after logging in.

> Account lockout triggers after repeated failed attempts — `locked_until` and `failed_login_attempts` columns on the `users` table. The app uses `bcryptjs` (not `bcrypt`).

---

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
- **Inner-page banner → logo-green gradient** — `.page-header` now `#00641C → #008B23 → #1FB24A` (the logo green) on **all** inner pages incl. Advocacy. Homepage hero unchanged.
- **Uploads** — profile photo uses a new image-only `memberPhoto` multer filter (JPEG/PNG/WebP, no PDF); `.jpg/.jpeg` extensions added to every `accept` for clearer file pickers.
- **Admin panel completed** — built the 7 previously broken/stub pages: `scholarship-app-detail` (review/approve/reject), content CRUD for **leadership/resources/advocacy/scholarships** (modals; leadership photo + resource file uploads via FormData), `sms-templates` (create/edit/deactivate), `sms-logs` (filter + pagination). BBF + member approve/reject/etc. upgraded from `prompt()` to inline modals (also fixed BBF action buttons that were bound to an unreachable IIFE-scoped function). **Authenticated exports** — added a blob-download helper in `admin-api.js` (members/BBF/analytics/audit); `window.open()` exports were failing with "Access token required" because they couldn't send the Bearer header.
- **KUPPET green/gold rebrand** — recoloured the whole site from deep-blue to the official logo palette via `:root` tokens (see Design tokens): green nav/buttons/gradients, gold accents, green-tinted tables/cards, dark-green footer.
- **Cache token** — now `20260621h` across all public HTML (bumped several times this session for `main.js`/`api.js`/`style.css` edits). NOTE: portal JS (`member/js/*`, `admin/js/*`) is **unversioned** — after editing it, hard-refresh; consider adding `?v=` to those `<script>` tags if stale-cache issues appear.

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

**Task 5 — TalkSasa SMS activation**
`backend/services/smsService.js` is fully built. `TALKSASA_API_KEY` and `TALKSASA_BASE_URL` are set in `.env`; remaining:
- Change `TALKSASA_SENDER_ID` from the default `TALKSASA` to the registered/approved sender ID
- Register a delivery webhook at `POST /api/sms/webhook` with TalkSasa

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
Hostinger serves CSS/JS with **no `cache-control`/`etag`**, so browsers hold stale assets after a deploy. Public CSS/JS links carry a version query, e.g. `href="/css/style.css?v=20260621h"`. **When you edit `style.css`, `portal.css`, `main.js`, or `api.js`, bump the `?v=` string on every page** (sed across `public/**/*.html`) or returning visitors won't see the change. HTML files themselves aren't versioned (they revalidate). Current token: `20260621h`.
> ⚠ Caveat: portal JS (`member/js/member-portal.js`, `member/js/member-api.js`, `admin/js/admin-portal.js`, `admin/js/admin-api.js`) is loaded **without** a `?v=` query, so the convention above does not cover it. Editing those files relies on browser revalidation — hard-refresh after deploying portal-JS changes (e.g. member TSC login + admin export fixes live there); if stale-cache issues appear, add a `?v=` to those `<script>` tags.

### Responsive header (public pages)
All public pages share an identical topbar + header (only the active nav link differs — keep them in sync). Layout bands (driven by media queries in `style.css`):
- `≤1780px` — hide the logo tagline + tighten nav (full header doesn't fit beside both CTA buttons)
- `≤1300px` — header CTA buttons become icon-only (`.cta-label` hidden)
- `≤960px` — inline nav collapses into the slide-in **hamburger drawer** (`.main-nav`); CTAs move into `.nav-cta` inside the drawer; `main.js` hamburger/dropdown breakpoints also use `960`
The "Get Help" (→ contact) + "Member Login" (→ member login) buttons live in `.header-cta` (desktop) and are duplicated in `.nav-cta` (drawer).

### Admin roles
| Role | Access |
|------|--------|
| `super_admin` | Full access to everything |
| `branch_officer` | Can review/recommend; cannot delete admins, change system settings, or access audit logs |

Middleware: `authorizeAdmin` allows both roles. `authorizeSuperAdmin` allows only `super_admin`.

### JWT setup
Two separate secrets are **required** and must differ:
- `JWT_SECRET` — signs admin tokens (7-day expiry)
- `JWT_MEMBER_SECRET` — signs member tokens (30-day expiry)

Server throws at startup if they are equal.

### Auth identifiers
- **Members** log in with **TSC number + password** (`members.tsc_number`). Email is still collected at registration (unique) but isn't the login identifier. Password reset is by email (see forgot/reset flow).
- **Admins** log in with **email + password** (+ optional TOTP 2FA).

### Email (SMTP) — required for password reset & notification emails
`backend/services/mailerService.js` sends via nodemailer when `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are set (else it logs & skips). `APP_URL` (e.g. `https://kuppetmigori.co.ke`) is used to build links in emails (password reset). Live uses the Hostinger mailbox for `info@kuppetmigori.co.ke` (`smtp.hostinger.com:465`). Test with `node backend/scripts/test-email.js you@example.com`.

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
- `news.category`: `news | announcement | circular | press_release | event`
- `resources.category`: `curriculum | circular | moe_document | tsc_resource | professional_dev | teaching_material | legal | policy`
- `contacts.category`: `general | membership | bbf | advocacy | resources | complaint | other`

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
Files stored in `public/uploads/{category}/` with UUID filenames. Sensitive member documents (national ID, passport photo) are **not** served as static files — they go through `GET /api/member/documents/:filename` which verifies ownership before streaming.

Upload subdirectories: `photos/`, `documents/`, `bbf/`, `scholarships/`, `members/`

**⚠ Production note:** `public/uploads/` is ephemeral on Render/Railway free tier. Swap `multer` disk storage for `multer-s3` before deploying.

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

### Design tokens (CSS custom properties) — KUPPET brand palette (logo colours)
Redefined 21 June 2026 from deep-blue to the official KUPPET green/gold. The whole
site is token-driven, so most components recolour from `:root`; remaining hardcoded
tints were swapped (old blue RGB `27,58,110` → `0,138,75`, old gold `200,150,42` →
`200,168,107`). Hero/page-header/membership gradients use `var(--primary) → var(--primary-dark)`.
```
--primary:       #008A4B  (brand green — nav active, buttons, headers, gradients)
--primary-dark:  #006B3A  (green hover; footer + topbar background)
--primary-light: #2FB36C
--primary-tint:  #E8F4EE  (subtle green surface — table zebra, hovers, badges)
--gold:          #C8A86B  (secondary — highlights, badges, CTA accents)
--gold-light:    #DFC79A
--gold-dark:     #A8874F  (gold hover)
--red:           #DC2626  (error)
--green:         #10B981  (success)
--warning:       #F59E0B
--text:          #1F2937  (headings)
--text-muted:    #4B5563  (body)
--text-light:    #9CA3AF
--bg:            #F8FAF9  (soft off-white page bg)
--bg-white:      #FFFFFF  (cards)
--bg-dark:       #064E33  (deep green — portal sidebar)
--border:        #E5E7EB
--shadow-card:   0 4px 20px rgba(0,0,0,0.08)
```
Component conventions: cards = 16px radius + soft shadow + 3px green top accent;
data-tables = green header + green-tint zebra; footer = `--primary-dark` + gold top
border; nav active = green tint + gold underline. Note: `.btn-gold` keeps white text
per brand spec (low-contrast — use sparingly for small labels).

Portal-specific status badge classes (in `portal.css`):
`.status-badge--pending_approval`, `.status-badge--approved`, `.status-badge--rejected`,
`.status-badge--suspended`, `.status-badge--draft`, `.status-badge--submitted`,
`.status-badge--under_review`, `.status-badge--paid`
