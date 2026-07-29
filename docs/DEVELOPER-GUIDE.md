# KUPPET Migori — Developer Guide

Orientation for a developer new to this codebase. It covers how the system is put
together, the conventions you are expected to follow, and the traps that have
actually bitten people here.

**Related docs**
- `CLAUDE.md` (repo root) — living status file: what is built, what is deployed, per-change history. Authoritative for *current state*; this guide is authoritative for *how things work*.
- `docs/SESSION-NOTES.md` — dated narrative of past development sessions.
- `docs/MEMBER-IMPORT.md` — runbook for bulk-importing member rosters.
- `docs/MEMBER-GUIDE.md` — end-user documentation for members.

---

## 1. What this is

A web application for the KUPPET (Kenya Union of Post Primary Education Teachers)
Migori branch. It serves three audiences from one Express process:

1. **A public website** — news, events, resources, leadership, scholarships, an advocacy desk, a contact form.
2. **A member portal** — teachers register, log in, file **BBF** (Benevolent Benefit Fund) claims, apply for scholarships, and track both.
3. **An admin portal** — branch staff review and decide those claims and applications, manage content and members, track court and disciplinary cases, and send SMS/email.

| | |
|---|---|
| **Runtime** | Node.js ≥ 18, Express 4 |
| **Database** | MySQL (via `mysql2/promise` pool), 34 tables |
| **Frontend** | Vanilla JS + hand-written CSS. No build step, no framework, no bundler. |
| **Auth** | Two separate JWT realms (admin / member), plus optional TOTP 2FA for admins |
| **Hosting** | Hostinger Business shared hosting, auto-deploying from GitHub `main` |
| **Live** | https://kuppetmigori.co.ke |
| **Tests** | None configured. There is no linter either. |

That last row is not an oversight to fix casually — the code compensates with
heavy inline commenting explaining *why* non-obvious things are the way they are.
Read the comments before changing the code they sit on; most of them exist
because something broke in production.

---

## 2. Running it locally

```bash
cp .env.example .env      # then fill in DB credentials and the two JWT secrets
npm install
npm run init-db           # creates the schema and seeds data (re-runnable)
npm run dev               # nodemon on port 3000
```

`npm start` runs it without auto-reload. To re-seed from scratch:

```bash
mysql -u root -p < backend/config/init.sql
```

**The server refuses to boot** if any of these fail (`backend/server.js:19-35`) —
this is deliberate, since each one is silent-but-serious in production:

- `JWT_SECRET` and `JWT_MEMBER_SECRET` are both set **and equal** → a member token would authenticate as an admin.
- `TOTP_ENCRYPTION_KEY` is not 64 random hex characters, or is all zeroes. Generate with `openssl rand -hex 32`.
- `NODE_ENV=production` without `FRONTEND_URL` → CORS would fall back to localhost.

---

## 3. Environment variables

`.env.example` is kept current and commented; it is the reference. The grouping:

| Group | Variables | Notes |
|---|---|---|
| Database | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASSWORD` `DB_SOCKET` `DB_POOL_LIMIT` | Pool size defaults to 15 |
| Auth | `JWT_SECRET` `JWT_MEMBER_SECRET` `JWT_EXPIRES_IN` (7d) `JWT_MEMBER_EXPIRES_IN` (30d) | The two secrets **must differ** |
| 2FA | `TOTP_ENCRYPTION_KEY` `TOTP_APP_NAME` | Key encrypts admin TOTP secrets at rest |
| Lockout | `LOGIN_MAX_ATTEMPTS` (5) `LOGIN_LOCK_MINUTES` (30) | Applies to both admin and member login |
| Uploads | `UPLOAD_DIR` | **Critical in production** — see §8 |
| Email | `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` `CONTACT_EMAIL` `ALERT_EMAIL` `APP_URL` | Unset → mailer logs and skips, never throws |
| Advocacy mailbox | `ADVOCACY_EMAIL` `ADVOCACY_SMTP_HOST/PORT/USER/PASS` | See §9 — setting only `ADVOCACY_EMAIL` is not enough |
| SMS | `TALKSASA_API_KEY` `TALKSASA_SENDER_ID` `TALKSASA_BASE_URL` `SMS_WEBHOOK_SECRET` | |
| Bulk send tuning | `SMS_BACKGROUND_THRESHOLD` (25) `SMS_BATCH_SIZE` `SMS_BATCH_DELAY_MS` `EMAIL_BACKGROUND_THRESHOLD` (25) `EMAIL_SEND_DELAY_MS` | Above the threshold, a bulk send returns immediately and continues in the background |
| Rate limits | `GLOBAL_RATE_MAX` (600) `GLOBAL_RATE_WINDOW_MIN` (5) `SCH_APPLY_RATE_MAX` (30) `REG_ATTEMPT_RATE_MAX` (40) | See §11 |
| Misc | `NODE_ENV` `PORT` `FRONTEND_URL` | |

---

## 4. Architecture

### Hybrid multi-page app

Express serves static HTML from `public/` as a traditional MPA. There is **no
build step** — what is in `public/` is what the browser gets. Inside that MPA sit
two authenticated single-page-ish portals (`public/member/`, `public/admin/`),
which are still separate HTML files per screen but share a JS runtime.

**Public page request flow**

```
browser loads /pages/news.html   (static file)
  → page JS calls api.news.getAll()      (public/js/api.js)
    → GET /api/news                       (Express router → controller → MySQL pool)
      → { success, data, message } JSON
        → main.js render*() writes DOM, escaping through escHtml()
```

**Portal request flow**

```
browser loads /admin/bbf.html    (static file)
  → page calls adminApi.bbf.getAll()      (admin/js/admin-api.js)
    → GET /api/admin/bbf
       headers: Authorization: Bearer <JWT>, X-CSRF-Token: <cookie value>
      → authenticate → authorize* → controller → MySQL
```

### Directory map

```
backend/
  server.js              Entry point. Middleware order, all route mounts,
                         rate limiters, static serving, sitemap, error handler.
                         Read this first — it is the map of everything.
  config/
    database.js          The single mysql2/promise pool. Import this, never
                         create your own connection.
    paths.js             Upload-root resolution (UPLOAD_DIR or ./public/uploads)
    init.sql             Authoritative schema + seed data (re-runnable)
    init-hostinger.sql   Same, minus CREATE DATABASE, for shared hosting
    initDb.js            What `npm run init-db` runs
    migration-*.sql      25 migration files (numbered #1–26 in CLAUDE.md),
                         all applied on live, kept for re-provisioning
  controllers/  (26)     Async handlers. Parameterised queries. JSON responses.
  routes/       (31)     Thin routers: validators + middleware + controller ref
  middleware/            auth.js  csrf.js  upload.js  validate.js
  services/              mailerService  smsService  notificationService  alertService
  utils/                 pagination  sanitizeHtml  memberProfile  excel  schools  uploads
  scripts/               import-members  create-demo-member  test-email  test-sms

public/
  index.html             Homepage
  pages/        (8)      Public pages
  css/                   style.css (public) + portal.css (both portals)
  js/                    api.js  main.js  school-picker.js
  admin/        (31 html) + admin/js/{admin-api,admin-portal}.js
  member/       (13 html) + member/js/{member-api,member-portal}.js
  images/                Logo, favicons, leader photos, group photos
```

### Middleware order in `server.js`

Order matters, and several bugs here were caused by getting it wrong. Current
sequence:

1. `trust proxy` = 1 — makes `req.ip` the real client IP behind Hostinger's nginx
2. `helmet` (CSP, HSTS) → custom `Permissions-Policy`
3. `cors` → `morgan` → `cookieParser`
4. `issueCsrfCookie` — **before** static serving, so portal HTML always carries the cookie
5. `express.json` / `urlencoded`, both capped at 50kb
6. Rate limiters: per-route first, then the global ceiling
7. 404 block on sensitive upload subdirectories, **before** the `/uploads` static mount
8. Static serving (`/uploads`, then `public/`)
9. API routers: public → admin auth → CSRF gate → member routers → admin routers
10. `/sitemap.xml`, SPA fallback (`app.get('*')`), global error handler

---

## 5. Backend conventions

### Controller shape

```js
async function getAll(req, res) {
  try {
    const limit = clampLimit(req.query.limit);      // never bind raw parseInt
    const offset = clampOffset(req.query.offset);
    const [rows] = await db.query('SELECT … LIMIT ? OFFSET ?', [limit, offset]);
    res.json({ success: true, data: rows, total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to …' });
  }
}
```

Every response is `{ success, data?, message? }`. List endpoints also return
`total`, which the shared pager needs.

### Rules that are not optional

- **Parameterised queries only.** No string interpolation into SQL, anywhere.
- **Clamp pagination** with `utils/pagination.js` — `clampLimit(v, def, max=100)` and `clampOffset(v)`. Binding a raw `parseInt(req.query.limit)` to `LIMIT` gives you a 500 on `NaN` and a full-table dump when unbounded.
- **Validate on mutation routes** with `express-validator`, then `handleValidation` from `middleware/validate.js`. On multipart routes it must come *after* multer so `req.body` is populated.
- **Sanitise rich text** through `utils/sanitizeHtml.js` before storing admin-authored HTML.
- **Audit mutations** with the `auditLog(action)` middleware factory. It writes actor, action, resource, IP and user-agent to `audit_logs`, and never throws.

### Sequence numbers

Member numbers (`MBR-YYYY-NNNNNN`), BBF claim numbers (`BBF-…`) and scholarship
application numbers (`SAPP-…`) come from atomic counters in the `settings` table
(`member_seq`, `bbf_seq`, `schapp_seq`).

**Never use `COUNT(*)+1`.** And note the subtlety already fixed once in
`memberAuthController.nextSeq`: the `UPDATE` and the `SELECT LAST_INSERT_ID()`
must run **on the same pooled connection**, because `LAST_INSERT_ID()` is
connection-scoped — reading it from a different pool connection returns another
request's value under concurrency.

### The status-decision race

Every admin decision endpoint reads a row, checks the transition, then updates.
That check alone is TOCTOU, and a transaction does not fix it because the
`SELECT` is not `FOR UPDATE`.

**Make the `UPDATE` conditional on the status you just read, and check
`affectedRows`:**

```js
const [upd] = await conn.query(
  'UPDATE bbf_claims SET status = "approved" WHERE id = ? AND status = ?',
  [claim.id, claim.status]
);
if (!upd.affectedRows) throw new StaleClaim();   // → 409, admin reloads
```

Without it, two admins — or one double-click — each write a timeline row and each
fire a notification. `StaleClaim` (`adminBbfController`) and `StaleApplication`
(`adminSchAppController`) both map to **409**, not a bare 500.

---

## 6. Authentication and authorization

### Two separate realms

|  | Admins | Members |
|---|---|---|
| Login identifier | Email + password (+ optional TOTP) | **TSC number** + password |
| Signing secret | `JWT_SECRET` | `JWT_MEMBER_SECRET` |
| Token lifetime | 7 days | 30 days |
| Middleware | `authenticate` → `req.user` | `authenticateMember` → `req.member` |
| Browser storage | `sessionStorage.adminToken` | `sessionStorage.memberToken` |
| Idle logout | 30 min (`ADMIN_IDLE_MS`) | 30 min (`MEMBER_IDLE_MS`) |

Tokens live in **`sessionStorage`**, not `localStorage` — they are cleared when
the last tab closes. Each portal HTML file also carries a tiny inline script in
`<head>` that redirects to the login page before any content renders if the token
is missing or the idle timestamp has expired.

### Admin roles

| Role | Access |
|---|---|
| `super_admin` | Everything |
| `branch_officer` | Review, recommend, **and make all member/application decisions**; no admin management, settings or audit logs |
| `branch_secretary` | Peer of `branch_officer` for viewing/reviewing/printing, but makes **no decisions** and is excluded from Legal (court + disciplinary cases) and advocacy reports |
| `content_admin` | **Content only** — news, events, resources, leadership, scholarship listings, advocacy, announcements, plus own account security |

The gates in `middleware/auth.js`:

- `ADMIN_ROLES = ['super_admin','branch_officer','branch_secretary']` — note `content_admin` is deliberately **absent**.
- `authorizeAdmin` — any of `ADMIN_ROLES`
- `authorizeSuperAdmin` — `super_admin` only
- `authorizeRoles(...roles)` — `super_admin` plus the listed roles. Used as `authorizeRoles('branch_officer')` for Legal and for every decision route.
- `authorizeContent` — `authorizeRoles('branch_officer','branch_secretary','content_admin')`, used by the seven content routers only.

`content_admin` is the pattern to copy for future scoped roles: exclude it from
`ADMIN_ROLES` and grant it through a dedicated gate, rather than adding a peer
role that has no route access.

**Frontend gating is cosmetic.** Pages compute e.g.
`canDecide = role ∈ {super_admin, branch_officer}` and hide buttons, and
`initSidebar` hides `data-super-only` / `data-court-only` / non-`data-content-ok`
items. The backend gate is what actually enforces it — always add both.

### CSRF

Double-submit cookie (`middleware/csrf.js`). The server issues a `__csrf` cookie
early in the chain; portal JS reads it and echoes it as the `X-CSRF-Token` header
on every non-GET request to `/api/member` or `/api/admin`. The server compares
cookie against header.

If the cookie is missing (an entry page that POSTs before it has ever made a GET
— registration was the real case), the client **mints one itself**. That is
equally safe here: the protection comes from an attacker's inability to read or
set your cookie cross-origin, not from server-side knowledge of the value.

**Consequence:** any admin/member mutation made with a raw `fetch()` will 403.
Always go through `adminApi.*` / `memberApi.*`, which add the header. This has
already bitten the SMS group-send once.

---

## 7. Data model

34 tables. Grouped by concern:

- **Public content** — `news`, `events`, `resources`, `leadership`, `scholarships`, `advocacy`, `announcements`, `contacts`, `settings`, `schools`
- **Membership** — `members`, `notifications`
- **BBF welfare** — `bbf_claims`, `bbf_claim_documents`, `bbf_claim_timeline`
- **Scholarships** — `scholarship_applications`, `scholarship_application_documents`, `scholarship_application_timeline`
- **Communications** — `sms_logs`, `sms_templates`, `email_logs`, `email_templates`, `transactional_templates`, `notification_templates`
- **Security/audit** — `users`, `audit_logs`, `login_history`, `admin_2fa`
- **Legal** — `court_cases`, `court_case_updates`, `court_case_documents`
- **Legal (disciplinary)** — `disciplinary_cases`, `disciplinary_case_updates`, `disciplinary_case_documents`

`backend/config/init.sql` is the authoritative schema and carries the full ENUM
definitions; `CLAUDE.md` lists the key ENUM values with the dates they changed.

### The three workflows

**Member registration**
```
pending_approval → approved | rejected
                       ↓
                   suspended
```

**BBF claim** — two claim types only, `death` and `retirement`.
```
draft → submitted → under_review → approved → paid
                                 → rejected
```
- The member never re-enters their own identity: `create` ignores client-sent identity fields and reads `tsc_no`, `sub_county`, `school`, `school_category` from the logged-in member's row.
- `draft` claims are excluded from every admin list, count and export — they are unsubmitted work-in-progress.
- **Documents lock once the claim leaves `draft`.** They are the basis the decision is made on, and a later change would leave no trace in the timeline.
- `BBF_DOC_SLOTS` in `memberBbfController` is the single source of truth for which `doc_type`s are allowed and which are required per claim type. It mirrors `BBF_DOC_SLOTS_DEATH` / `_RETIREMENT` in `member-portal.js` — **keep the two in step.**
- One slot holds exactly one document; re-uploading replaces (old row deleted in the transaction, old file unlinked after commit).

**Scholarship application** — no draft stage; created atomically at `applied`.
```
applied → under_review → approved → paid
                       → rejected
```
- One application per member per scholarship, enforced by `UNIQUE(member_id, scholarship_id)`. The read-then-write check in front of it is a courtesy; the unique key is the guarantee (`ER_DUP_ENTRY` → 409).
- The deadline is enforced **in SQL** (`IS_CLOSED_SQL`) so the API and the public site cannot disagree about "today". The deadline day itself is still open; a null deadline is open-ended.
- The form collects only two uploads (Letter of Application, TSC Slip). The old study-detail columns — `institution`, `course`, `year_of_study`, `academic_year`, `essay` — are NULL on everything created since July 2026 and the admin UI hides those sections when empty.

Both workflows write a timeline row and fire a notification on every status
change. Scholarship timeline reads/writes are wrapped best-effort (try/catch) so
a fresh install that has not run migration #26 cannot break the flow — **keep
that guard.**

---

## 8. File uploads

Handled by multer 2.x (`middleware/upload.js`), which exports nine configured
instances — pick the one whose destination and MIME allowlist match, rather than
adding a new one:

| Instance | Destination | Cap | Accepts |
|---|---|---|---|
| `photo` | `photos/` | 2 MB | images |
| `memberPhoto` | `members/` | 2 MB | images |
| `document` | `documents/` | 10 MB | documents |
| `bbfDocs` | `bbf/` | 10 MB | PDF + images |
| `scholarshipDocs` | `scholarships/` | 5 MB | PDF + images |
| `memberDocs` | `members/` | 5 MB | PDF + images |
| `courtDocs` | `court/` | 10 MB | documents |
| `disciplinaryDocs` | `disciplinary/` | 10 MB | documents |
| `newsMedia` | `news/` | 10 MB | images + document |

**Three rules, each of which exists because of a real incident:**

1. **Uploads must live outside the git-deployed tree.** Hostinger's GitHub auto-deploy restores the working tree on every deploy, wiping anything inside it — this is what blanked the admin-uploaded leader photos in June 2026. Production sets `UPLOAD_DIR=/home/u735599564/uploads`, above `public_html`. Locally, leaving it unset falls back to `./public/uploads`. The root is resolved once in `backend/config/paths.js`.

2. **Filenames are UUIDs and the extension is sanitised.** `safeExtension()` accepts only `/^\.[a-z0-9]{1,10}$/` and otherwise stores no extension. The uploader controls `originalname`, and `path.extname` returns everything after the last dot — an unsanitised extension carried quotes into `file_url` and out into an admin page's inline `onclick`, which was a live member→admin XSS. Type is enforced on the **MIME type**, never the name.

3. **Clean up orphans.** Multer writes every accepted file *before* your handler runs, and cleans up only when *it* fails. `utils/uploads.js` provides `removeUploadedFiles(req)` — wired into `handleValidation` and the global error handler — and `removeStoredFile(fileUrl)` for a superseded file (call it only after the DB row is gone). **A controller that responds without recording an upload must call `removeUploadedFiles` itself**, since neither shared hook sees that request.

**Access control.** Files live in subdirectories: `photos/`, `documents/`, `news/`
are public; `members/`, `bbf/`, `scholarships/`, `court/`, `disciplinary/` are
404-blocked from static serving (in `server.js`, *before* the `/uploads` static
mount) and streamed only through checked endpoints:

- `GET /api/member/documents/:filename` — verifies the file belongs to the logged-in member
- `GET /api/admin/documents/:filename` — `authenticate` + `authorizeAdmin`, with the `court_case_documents` and `disciplinary_case_documents` branches dropped for roles outside Legal

Because those need a Bearer token, a plain `<a href>` cannot fetch them. Admin
pages use `viewDoc()`, which fetches the blob — triggered by a
**`data-view-doc="<url>"` attribute plus one delegated listener**, never an inline
`onclick`. See §12.

---

## 9. Integrations

### Email — `services/mailerService.js`

nodemailer, active only when `SMTP_HOST/PORT/USER/PASS` are all set; otherwise it
logs and skips. It never throws, so a mail failure cannot break a request.

Three tiers of template, which is the part that confuses newcomers:

| Tier | Stored in | Edited where |
|---|---|---|
| **Hardcoded** — `memberNotice`, `adminEmail`, `contactStaffAlert`, `contactReply` | code only | not editable |
| **Transactional** — the 5 automated system emails, in `TRANSACTIONAL_TEMPLATES` | defaults in code, overrides in `transactional_templates` | Email Templates → Automated Emails |
| **Reusable** — admin-composed templates | `email_templates` | Email Templates |

Four transactional templates are editable; **`password_reset` is deliberately
not** (`editable: false`) — it is security-sensitive and depends on a one-time
`{{reset_link}}`. `PUT`/`DELETE` on it return 403.

The four editable ones are stored as **plain text**; `plainToHtml()` renders
paragraphs and auto-links URLs at send time. `renderTransactional` still renders
as HTML when a body *looks* like HTML, so legacy overrides keep working.

Overrides are cached in memory (single instance), loaded by
`loadTransactionalCache()` at startup and refreshed after each save.

**Advocacy replies are a special case.** Setting `ADVOCACY_EMAIL` alone is not
enough — Hostinger, like most servers, rejects a `From` the SMTP login is not
authenticated for, which made every advocacy reply 502. `sendAdvocacyMail` uses
the advocacy mailbox's own SMTP credentials when
`ADVOCACY_SMTP_USER`/`_PASS` are set, and otherwise falls back to the main login
with a branded display name and `Reply-To: advocacy@`.

### Notifications — `services/notificationService.js`

`createNotification()` inserts into `notifications` and optionally triggers SMS
and email. It also owns the **8 editable application-status templates** for BBF
and scholarship events: `NOTIFICATION_TEMPLATES` defaults, overrides in
`notification_templates`, rendered via `renderNotification(key, vars)`.

Templates support `{{placeholders}}` plus `{{#var}}…{{/var}}` and
`{{^var}}…{{/var}}` sections (render only when a value is set / unset — used for
the approved amount, rejection reason, payment reference).

**`renderNotification` always renders `sms` from the code default**, ignoring any
override, so the text-message channel stays code-controlled. The admin UI exposes
title and body only.

### SMS — `services/smsService.js`

TalkSasa **v3** API. Always logs to `sms_logs`, never throws. A delivery webhook
at `POST /api/sms/webhook` updates `sms_logs.status` from the DLR.

Diagnostics: `node backend/scripts/test-sms.js +2547… "message"`.

⚠ **SMS does not currently deliver in production.** The code is verified correct;
the blocker is that the TalkSasa Sender ID must be network-registered with
Safaricom/Airtel. Sends report "Delivered" and never arrive — the classic
unregistered-sender-ID symptom. Do not go debugging the code for this.

### Error alerts — `services/alertService.js`

Emails an admin on 500s, uncaught exceptions and unhandled rejections. Throttled
to one alert per 10 minutes so an error burst cannot flood the inbox. Recipient
resolves `ALERT_EMAIL` → `CONTACT_EMAIL` → `SMTP_USER`; no-ops if none is set.

---

## 10. Frontend conventions

### Body-class gating

Every public page's `<body>` carries a class that gates the matching `init*`
function in `main.js` — `home-page`, `news-page`, `resources-page`, `about-page`,
`scholarships-page`, `advocacy-page`, `article-page`, `advocacy-article-page`.
Portals use `admin-*-page` / `member-*-page` classes gating functions in their
own portal JS. Adding a page means adding both halves.

### Escaping — the rule that matters most

- **Interpolate every value through `escHtml()`**, including attribute values and image `src`.
- **For `href`, use `safeUrl()`** — `escHtml()` alone does not neutralise a `javascript:` URL. `safeUrl()` allows only http/https/mailto/tel and relative paths, else `#`.
- **Never interpolate a value into an inline handler.** `escHtml` is HTML-escaping, not JS-string escaping, and the browser decodes an attribute *before* parsing it as JS. Use a `data-` attribute plus a delegated listener — in an attribute the value is data, never code.

### Asset cache-busting

Public CSS/JS links carry a version query: `href="/css/style.css?v=20260728d"`.

**When you edit `style.css`, `portal.css`, `main.js`, `api.js`, or any portal JS,
bump the `?v=` token on every page** (a `sed` across `public/**/*.html`) or
returning visitors keep the old file. HTML itself is served `Cache-Control:
no-cache` so it always revalidates, which is what makes the bumped token visible
immediately after a deploy.

Changes to inline `<script>` inside an HTML file need **no** bump — the HTML
carries them and is never cached.

### Shared portal helpers

- `renderAdminPager(elId, {total, offset, limit, onPage})` — the standard "N–M of T" pager. Each list page has a `<div id="…-pager">` and calls it after rendering, resetting `offset` to 0 when a filter changes.
- **Automatic button busy-state** — `admin-api.js` tracks the last-clicked button and marks it busy (spinner, disabled, `pointer-events:none`) for the duration of the request it triggers. Zero per-button wiring; opt out with `data-no-busy`. This is what stops a double-click becoming a duplicate row.
- `submitOnce(btn, fn)` for modal saves; ref-counts with the above so the two compose.
- `printApplication({heading, subheading, sections, footer})` — details-only print used by the BBF and scholarship detail pages.
- `SchoolPicker` (`public/js/school-picker.js`) — touch-friendly typeahead on `<input data-school-picker>`, sourced from `GET /api/schools`. It exists because `<datalist>` renders unreliably or not at all on mobile. Member-facing pages use the picker; desktop-only admin filters still use a datalist.

### CSS

One design system in `style.css` (public) and `portal.css` (both portals), driven
by custom properties — deep blue `--primary: #1B3A6E` throughout, **except** the
green gradient banners on the homepage hero, inner-page headers and portal login
pages. A full green/gold rebrand was tried and reverted; keep the green-banner /
blue-rest split unless asked otherwise.

Add `.h-scroll` to a card grid to turn it into a horizontal scroll-snap row at
≤640px instead of a long vertical stack. **Gotcha:** if an `.h-scroll` sits inside
a CSS-grid parent, give that parent `minmax(0,1fr)` tracks or the wide row forces
page-wide horizontal overflow.

---

## 11. Rate limiting

All limits are **per client IP** — `express-rate-limit` v7 with the default key
(`req.ip`), which `trust proxy = 1` resolves from `X-Forwarded-For`.

| Scope | Limit |
|---|---|
| **Everything** (global ceiling) | 600 / 5 min |
| All `/api/*` | 200 / 15 min |
| `POST /api/contact` | 5 / hr |
| `POST /api/auth/login`, `POST /api/member/auth/login` | 20 / 15 min |
| `POST /api/member/auth/register` | 8 / hr counting successes only, plus a 40 / hr backstop counting every attempt |
| `POST /api/member/auth/forgot-password` | 5 / hr |
| `POST /api/member/scholarships/:id/apply` | 30 / 15 min |
| Admin SMS / email send | 20 / min; bulk 3–5 / hr |

Two caveats worth internalising:

- **The store is in-memory.** Counters reset on every restart and redeploy, and are not shared across instances. Fine on single-instance Hostinger; needs Redis if ever scaled out.
- **Users behind one NATed public IP share a bucket** — a whole school arrives as one client. That is why the global ceiling is sized at ~20 page views a minute and is env-tunable.

⚠ **If a second proxy (e.g. Cloudflare) is ever put in front of the site, fix
`trust proxy` in the same change.** With two hops `req.ip` resolves to the
proxy's address: every visitor collapses into one bucket and the site locks
itself out. `req.ip` also feeds `audit_logs.ip_address`,
`login_history.ip_address` and `contacts.ip_address`, which would silently record
the proxy instead of the visitor.

---

## 12. Gotchas

The short list of things that have actually caused production bugs.

**Deployment**
- Pushing to `main` deploys to production immediately. There is no staging environment.
- A deploy restores the working tree — anything written into it at runtime is lost. See §8.
- **Do not add a static `public/sitemap.xml`.** `express.static` would shadow the dynamic route, which is what happened before; only the 7-page static file was ever served. The route is memoised for an hour, and a DB-degraded render is deliberately not cached.

**Database**
- Migrations #1–26 are all applied on live and folded into `init*.sql`. A **fresh** install starts with an empty `schools` table — the seed and backfill steps live only in `migration-schools.sql`.
- The curated `schools` list is the source of truth: registration and profile-save reject a school that is not on the active list. **Empty-list guard:** if the table is empty or missing, enforcement is skipped so it can never block all registrations — the corollary is that emptying the list silently turns validation off rather than rejecting everything.

**Members**
- `members.national_id` is the bulk-import **default password** until changed, and it is displayed in the admin members list and detail page. Any admin viewing that screen is seeing unchanged default passwords.
- Profile save: branch UI on **`just_onboarded`**, not `onboarding_complete`. The latter is true for every already-onboarded member, so branching on it made every ordinary edit announce "Profile complete!" and redirect to the dashboard.
- A required profile field may be filled in or corrected but **never cleared** — a blank over an existing value is a 400 naming the field.
- The completeness flag is deliberately **one-way (0 → 1)**. Many live members predate `job_group` and are flagged complete with it null; recomputing in both directions would lock them all back into onboarding.

**Admin UI**
- Put the `display:flex` button wrapper in list-table action cells on an **inner `<div>`, not the `<td>`**. A flex `<td>` leaves table layout, so the cell stops stretching to row height and its `border-bottom` renders misaligned.
- Any mutation made with raw `fetch()` will 403 on CSRF. Use the API wrappers.

**Rate limits**
- `contactLimiter` applies to `POST /api/contact` only. It used to cover the whole path, so admins loading the Contact Inbox a few times hit the 5/hr limit and saw the public "too many submissions" message.

---

## 13. Where to look first

| Task | Start here |
|---|---|
| Understand the whole system | `backend/server.js` — every route, limiter and middleware in one file |
| Add an API endpoint | `backend/routes/*.js` for the router, `backend/controllers/*.js` for the logic |
| Change a workflow's rules | The relevant controller — `memberBbfController`, `adminBbfController`, `memberScholarshipController`, `adminSchAppController` |
| Change what a role can do | `backend/middleware/auth.js`, then the router's gate, then the page's `canDecide` / sidebar attributes |
| Change the schema | Write `backend/config/migration-<name>.sql`, apply it on live, then fold it into **both** `init.sql` and `init-hostinger.sql` |
| Debug a public page | `public/js/main.js` — find the `init*` gated on that page's body class |
| Debug a portal page | `public/{admin,member}/js/*-portal.js` — same pattern |
| Find why something is the way it is | `docs/SESSION-NOTES.md`, and the cache-token history in `CLAUDE.md` |
