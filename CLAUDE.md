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

## Project Status (as of 17 June 2026)

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
| **Member login + JWT auth + account lockout** | ✓ Complete |
| **Member portal — dashboard, profile, BBF claims, scholarships, notifications, history** | ✓ Complete |
| **Admin login with optional TOTP 2FA** | ✓ Complete |
| **Admin portal — 21 pages** | ✓ Complete |
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

**Branch Chairperson / Executive Secretary:** Henri Otunga  
**Official contact details (used sitewide — single source):**
- Phone: +254 721 808 993
- Email: info@kuppetmigori.co.ke (the **only** email used across the site)
- Address: Cosade Building, 3rd Floor, Front Wing, P.O. Box 842-40400, Migori Town, Kenya
- WhatsApp channel (only social link sitewide): https://whatsapp.com/channel/0029VbCDNtx23n3d4LFqbe15

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

### Done in the 17 June 2026 session
- **Responsive overhaul** — eliminated horizontal overflow on every public page across 320–1920px (Playwright-audited). Root-cause fixes only (no `overflow:hidden` masking): header compression `≤1780px`, icon-only CTA `≤1300px`, inline nav collapses to the hamburger **drawer at `≤960px`**, `.search-bar`/inputs `min-width:0`, `.btn { max-width:100% }`, advocacy form grid → `minmax(0,1fr)`.
- **Header standardized** — all 6 public pages share the **exact** topbar + header markup (only the active nav item differs). Restored the **Get Help** button (header CTA on desktop; inside the mobile drawer via `.nav-cta`).
- **Portal sidebar scroll fixed** — `.portal-sidebar { height:100vh; overflow:hidden }`, only `.sidebar-nav { flex:1; min-height:0; overflow-y:auto }` scrolls (admin + member).
- **Theme** — reverted the brief green experiment back to the deep-blue palette (see Design tokens).
- **Real content wired in** — official address (Cosade Building…, P.O. Box 842-40400), single email `info@kuppetmigori.co.ke` sitewide, WhatsApp channel as the only social link (with "follow for instant updates" copy), Google Maps `<iframe>` embed on contact page.

### Remaining tasks (pick up here next session)

**Task 1 — Article detail pages**
"Read More" links point to the list page, not a detail view:
- `public/pages/article.html` — reads `?slug=` from URL, calls `GET /api/news/:slug`, renders full content
- `public/pages/advocacy-article.html` — same pattern for `GET /api/advocacy/:slug`
- Update render helpers in `public/js/main.js` to point to these pages

**Task 3 — Real content (owner must supply)**
Still placeholder in the codebase:
- Other leader photos → upload to `public/images/leaders/` (only `henri-otunga.jpg` exists), update `photo_url` in DB via admin portal
- Real sub-county representative phone numbers (all 7 sub-counties currently reuse the main number)
- `index.html` schema.org `contactPoint.telephone` is still `+254-700-000-000` (placeholder) → set to the real number
- DONE this session: ✓ address ✓ email ✓ social links (WhatsApp) ✓ Google Maps embed

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
- 10 HTML pages

### Body-class convention (public pages)
Every `<body>` tag carries a class that gates the matching `init*` function in `main.js`:
- `home-page` → `loadHomepageData()`
- `news-page` → `initNewsPage()`
- `resources-page` → `initResourcesPage()`
- `about-page` → `initLeadershipPage()`
- `scholarships-page` → `initScholarshipsPage()`
- `advocacy-page` → `initAdvocacyPage()`

Admin and member portal pages use `admin-*-page` / `member-*-page` classes gating functions in their respective portal JS files.

### Asset cache-busting (IMPORTANT)
Hostinger serves CSS/JS with **no `cache-control`/`etag`**, so browsers hold stale assets after a deploy. Every local CSS/JS link carries a version query, e.g. `href="/css/style.css?v=20260617d"`. **When you edit `style.css`, `portal.css`, `main.js`, or `api.js`, bump the `?v=` string on every page** (sed across `public/**/*.html`) or returning visitors won't see the change. HTML files themselves aren't versioned (they revalidate). Current token: `20260617d`.

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

### Database schema (21 tables)
**Core (public site):** `users`, `leadership`, `news`, `events`, `resources`, `scholarships`, `advocacy`, `contacts`, `settings`

**Membership:** `members`, `bbf_claims`, `bbf_claim_documents`, `bbf_claim_timeline`, `scholarship_applications`, `scholarship_application_documents`, `notifications`

**SMS & comms:** `sms_logs`, `sms_templates`

**Security & audit:** `audit_logs`, `login_history`, `admin_2fa`

Key ENUM values:
- `users.role`: `super_admin | branch_officer | editor | viewer`
- `members.status`: `pending_approval | approved | rejected | suspended`
- `members.gender`: `male | female | other`
- `bbf_claims.status`: `draft | submitted | under_review | approved | rejected | paid`
- `bbf_claims.claim_type`: `death_benefit | disability | medical_emergency | other`
- `scholarship_applications.status`: `applied | under_review | approved | rejected`
- `news.category`: `news | announcement | circular | press_release | event`
- `resources.category`: `curriculum | circular | moe_document | tsc_resource | professional_dev | teaching_material | legal | policy`
- `contacts.category`: `general | membership | bbf | advocacy | resources | complaint | other`

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

Portal-specific status badge classes (in `portal.css`):
`.status-badge--pending_approval`, `.status-badge--approved`, `.status-badge--rejected`,
`.status-badge--suspended`, `.status-badge--draft`, `.status-badge--submitted`,
`.status-badge--under_review`, `.status-badge--paid`
