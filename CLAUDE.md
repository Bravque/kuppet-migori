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
- **`public/js/main.js`** — one `init*Page()` function per page (e.g. `initNewsPage`, `initScholarshipsPage`); all called unconditionally in `DOMContentLoaded` but each guards with a page-class selector check (e.g. `if (!document.querySelector('.news-page')) return`). Render helpers (`renderNewsCard`, `renderLeaderCard`, etc.) return HTML strings using `escHtml()` for XSS safety.
- **`public/css/style.css`** — single CSS file (~1600 lines); uses CSS custom properties (`--primary`, `--gold`, etc.); no build step required

### Page-class convention
Every `<body>` tag carries a class that gates which `init*` function runs:
- `home-page` → `loadHomepageData()`
- `news-page` → `initNewsPage()`
- `resources-page` → `initResourcesPage()`
- `about-page` → `initLeadershipPage()`
- `scholarships-page` → `initScholarshipsPage()`
- `advocacy-page` → `initAdvocacyPage()`

### Data-attribute conventions
- `data-counter="N"` + optional `data-suffix="+"` → animated counter (observed by `IntersectionObserver`)
- `data-stat="members|schools|years|resources"` → container matched by `loadSiteStats()` to update counter targets from the API
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
`/api/contact` is separately limited to 5 requests per hour per IP (configured in `server.js`). All other API routes share 200 req / 15 min.

### Adding a new content section
1. Add table to `init.sql`
2. Create `backend/controllers/fooController.js` (import `db`, export named functions)
3. Create `backend/routes/foo.js` (register routes, add `express-validator` on mutations)
4. Mount in `server.js`: `app.use('/api/foo', require('./routes/foo'))`
5. Add `api.foo.*` methods to `public/js/api.js`
6. Add `initFooPage()` + `renderFoo()` to `public/js/main.js`
7. Add `<body class="foo-page">` to the new HTML page and call the init in `DOMContentLoaded`
