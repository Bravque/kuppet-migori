# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env          # Fill in DB credentials
npm run init-db               # Create MySQL schema and seed data

# Development
npm run dev                   # Start with nodemon auto-reload (port 3000)
npm start                     # Production start

# Re-seed the database
mysql -u root -p < backend/config/init.sql
```

There are no tests or linting scripts configured yet.

---

## Project Status (as of June 2026)

**GitHub repo:** https://github.com/Bravque/kuppet-migori  
**Owner:** Bravque (bravinowino008@gmail.com)  
**Live domain (target):** kuppetmigori.co.ke — not yet deployed

### What is built and committed ✓

| Layer | Status |
|-------|--------|
| Express server + all REST API routes | ✓ Complete |
| MySQL schema (9 tables) + seed data | ✓ Complete |
| Homepage (`index.html`) | ✓ Complete |
| About Us page | ✓ Complete |
| Teachers Notice Board | ✓ Complete |
| Teacher Resource Centre | ✓ Complete |
| Advocacy Desk | ✓ Complete |
| Scholarships page | ✓ Complete |
| Contact Us page | ✓ Complete |
| CSS design system (1600+ lines) | ✓ Complete |
| Frontend JS — api.js + main.js | ✓ Complete |

**Official contact details already set:**
- Phone: +254 721 808 993
- Email: info@kuppetmigori.co.ke

### Remaining tasks (pick up here next session)

Work these in order — earlier tasks unblock later ones:

**Task 1 — Admin panel** *(highest priority)*
Build a password-protected `/admin` area:
- `public/admin/login.html` + `POST /api/auth/login` returning a JWT
- Protect all admin API routes with `backend/middleware/auth.js` (already written, not yet wired to routes)
- Dashboard page showing stats, recent contact submissions
- CRUD pages for: news, events, resources, leadership, scholarships, advocacy
- Contact submissions inbox (mark read/replied)
- Settings editor (chairman message, member stats)

**Task 2 — File uploads**
`multer` is installed but no upload endpoints exist yet:
- `POST /api/upload/resource` — PDF/DOCX, store in `public/uploads/resources/`
- `POST /api/upload/photo` — JPG/PNG/WEBP max 2 MB, store in `public/uploads/photos/`
- Add `public/uploads/` to `.gitignore`
- Wire into admin panel forms (Task 1)

**Task 3 — Email notifications**
`nodemailer` is installed but not used yet. In `backend/controllers/contactController.js`:
- On successful contact submission → email `CONTACT_EMAIL` from `.env`
- Subject: `[KUPPET Migori] New {category} enquiry from {name}`
- Auto-reply to submitter confirming receipt
- Fail gracefully — don't break the API if SMTP is down

**Task 4 — Article detail pages**
"Read More" links exist but no detail view:
- `public/pages/article.html` — reads `?slug=` param, calls `GET /api/news/:slug`, renders full content
- `public/pages/advocacy-article.html` — same pattern for `GET /api/advocacy/:slug`
- Update all "Read More" `href` values across `index.html` and `news.html`

**Task 5 — Real content**
Still placeholder in the codebase:
- Leader photos → upload to `public/images/leaders/`, update `photo_url` in DB
- Chairperson photo on homepage welcome section
- Real P.O. Box and street address (currently "P.O. Box 1234")
- Real Facebook, Twitter/X, WhatsApp, YouTube URLs (currently all `href="#"`)
- Google Maps API key in `.env` to enable embedded map on contact page
- Real sub-county representative phone numbers

**Task 6 — SEO files**
- `public/sitemap.xml` — all 7 pages
- `public/robots.txt` — allow all, point to sitemap
- Branded `og:image` 1200×630 px, add `<meta property="og:image">` to all pages
- Add canonical and full og:url tags to inner pages (missing on all except index)

**Task 7 — BBF Claims page**
Dedicated page instead of redirecting to contact form:
- `public/pages/bbf.html` — fields: member name, TSC number, deceased name, relationship, date of death, bank details, file upload for death certificate
- `POST /api/bbf` → new `bbf_claims` table in `init.sql`, notification email to welfare officer
- Update all "BBF Claims" quick-links and nav items

**Task 8 — Membership registration page**
- `public/pages/membership.html` — full form: name, TSC number, school, sub-county, ID number, phone, email, bank account
- `POST /api/membership` → new `members` table in `init.sql`, confirmation email
- Update all "Join KUPPET" CTA buttons

**Task 9 — Production deployment**
- Choose host: Railway, Render, or VPS
- Set up MySQL, run `init.sql`, configure all `.env` production values
- PM2: `pm2 start backend/server.js --name kuppet-migori && pm2 save`
- Point `kuppetmigori.co.ke` to server IP
- SSL via Let's Encrypt / certbot or hosting provider
- Run `npm audit fix` before going live

---

## Architecture

**Hybrid MPA**: Express serves static HTML files from `public/` as a traditional multi-page app. Each page (`index.html`, `pages/*.html`) fetches its data from REST API endpoints at `/api/*` and renders content client-side via `public/js/main.js`.

### Request flow
1. Browser loads an HTML page (served as static file)
2. Page calls `api.*` methods from `public/js/api.js` (a thin wrapper over `fetch`)
3. `api.js` hits `/api/*` routes → Express router → controller → `mysql2` pool query → JSON response
4. `main.js` receives JSON and calls a `render*()` function to inject HTML into the DOM

### Backend layout
- **`backend/server.js`** — Express entry: mounts middleware (Helmet, CORS, rate limiting), registers all API routers, serves `public/` as static root, SPA-style fallback for unknown paths
- **`backend/config/database.js`** — exports a single `mysql2` connection pool (`const db = require('../config/database')`)
- **`backend/config/init.sql`** — authoritative schema + seed data; re-runnable (uses `IF NOT EXISTS` / `INSERT IGNORE`)
- **`backend/routes/*.js`** — thin routers; validation middleware (via `express-validator`) lives here for POST routes
- **`backend/controllers/*.js`** — all SQL queries; build parameterised queries with array push pattern to avoid injection

### Frontend layout
- **`public/js/api.js`** — `window.api` object with namespaced methods (`api.news.getAll(params)`, `api.contact.submit(data)`, etc.)
- **`public/js/main.js`** — one `init*Page()` function per page; all called in `DOMContentLoaded` but each guards with a body-class check (e.g. `if (!document.querySelector('.news-page')) return`). Render helpers (`renderNewsCard`, `renderLeaderCard`, etc.) return HTML strings; all output passes through `escHtml()` for XSS safety.
- **`public/css/style.css`** — single CSS file (~1600 lines); CSS custom properties only; no build step

### Page-class convention
Every `<body>` tag carries a class that gates which `init*` function runs:
- `home-page` → `loadHomepageData()`
- `news-page` → `initNewsPage()`
- `resources-page` → `initResourcesPage()`
- `about-page` → `initLeadershipPage()`
- `scholarships-page` → `initScholarshipsPage()`
- `advocacy-page` → `initAdvocacyPage()`

### Data-attribute conventions
- `data-counter="N"` + optional `data-suffix="+"` → animated counter (IntersectionObserver)
- `data-stat="members|schools|years|resources"` → matched by `loadSiteStats()` to update counter targets from API
- `data-chairman-message` / `data-chairman-name` → text nodes overwritten by `loadSiteStats()`
- `data-download-id="N"` → triggers `api.resources.download(id)` on click

### Database schema (9 tables)
`users`, `leadership`, `news`, `events`, `resources`, `scholarships`, `advocacy`, `contacts`, `settings`

Key ENUM values to match exactly when inserting or filtering:
- `news.category`: `news | announcement | circular | press_release | event`
- `resources.category`: `curriculum | circular | moe_document | tsc_resource | professional_dev | teaching_material | legal | policy`
- `leadership.position_category`: `executive | committee | trustee`
- `contacts.category`: `general | membership | bbf | advocacy | resources | complaint | other`
- `scholarships.scholarship_type`: `undergraduate | postgraduate | vocational | research | international`

### Rate limiting
`/api/contact` is separately limited to 5 req/hr per IP. All other API routes share 200 req / 15 min.

### Auth middleware
`backend/middleware/auth.js` exports `authenticate` (verifies JWT Bearer token) and `authorizeAdmin` (checks `role === 'admin'`). These are written but **not yet applied to any routes** — wire them onto admin-only routes when building the admin panel (Task 1).

### Adding a new content section
1. Add table to `init.sql`
2. Create `backend/controllers/fooController.js` (import `db`, export named functions)
3. Create `backend/routes/foo.js` (register routes, add `express-validator` on mutations)
4. Mount in `server.js`: `app.use('/api/foo', require('./routes/foo'))`
5. Add `api.foo.*` methods to `public/js/api.js`
6. Add `initFooPage()` + `renderFoo()` to `public/js/main.js`
7. Add `<body class="foo-page">` to the new HTML page

### Design tokens (CSS custom properties)
```
--primary:       #1B3A6E  (deep blue — headers, buttons, nav)
--primary-dark:  #0F2347
--primary-light: #2D5AA0
--gold:          #C8962A  (accent — badges, highlights, CTA)
--gold-light:    #E5B94E
--red:           #C0392B  (advocacy section, alerts)
--green:         #1a7340  (success states, Kenya green)
--text:          #1A202C
--text-muted:    #718096
--bg:            #F7F9FC
--bg-dark:       #0F1B2D  (footer)
```
