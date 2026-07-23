/* KUPPET Migori — Admin Portal Logic
   Shared auth guard, sidebar, utilities and per-page init functions. */

// ── Utilities ─────────────────────────────────────────────────────────────────
function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Run a save/submit handler once, showing a spinner on its button and disabling
// it until the handler resolves, so a fast double-click can't fire the request
// twice (which creates duplicate rows). Uses the shared ref-counted busy helpers
// from admin-api.js (setButtonBusy/clearButtonBusy) — the same ones the API
// client applies automatically — so the two compose cleanly when the handler
// makes its own API call. Wire modal save buttons as:
//   onclick="submitOnce(this, saveThing)".
async function submitOnce(btn, fn) {
  if (btn && (btn.disabled || btn._busyCount)) return;  // already in flight — ignore repeats
  if (typeof setButtonBusy === 'function') setButtonBusy(btn);
  else if (btn) btn.disabled = true;
  try { await fn(); }
  finally {
    if (typeof clearButtonBusy === 'function') clearButtonBusy(btn);
    else if (btn) btn.disabled = false;
  }
}
window.submitOnce = submitOnce;

// Fetch a protected document as a Blob. Files are streamed from
// /api/admin/documents/:filename with the admin Bearer token (no longer public
// static assets), so a plain link/img src can't load them.
async function fetchDocBlob(fileUrlOrName) {
  const filename = String(fileUrlOrName).split('/').pop();
  const token = sessionStorage.getItem('adminToken');
  const res = await fetch('/api/admin/documents/' + encodeURIComponent(filename), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Could not load document (' + res.status + ')');
  return res.blob();
}

// Open a protected document in a new tab.
async function viewDoc(fileUrlOrName) {
  if (!fileUrlOrName) return;
  try {
    const url = URL.createObjectURL(await fetchDocBlob(fileUrlOrName));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    alert(err.message || 'Failed to open document');
  }
}
window.viewDoc = viewDoc;

// Lazy-load the locally-vendored PDF.js (self-hosted so it stays within the
// site CSP — script-src 'self', worker from 'self'). Loaded only when a print
// job actually contains a PDF. Returns the pdfjsLib global.
let _pdfjsPromise = null;
function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjsPromise) return _pdfjsPromise;
  _pdfjsPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/vendor/pdfjs/pdf.min.js';
    s.onload = () => {
      if (!window.pdfjsLib) return reject(new Error('pdf.js failed to initialise'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('pdf.js failed to load'));
    document.head.appendChild(s);
  });
  return _pdfjsPromise;
}

// Read a Blob as a data: URL (CSP img-src allows data: but not blob:, so we
// embed everything as data URLs for reliable printing in the popup window).
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('read failed'));
    fr.readAsDataURL(blob);
  });
}

// Render every page of a PDF blob to a JPEG data: URL via PDF.js, so PDF
// attachments print exactly like image attachments (guaranteed, browser-independent).
async function pdfToImageDataUrls(blob, scale = 1.6) {
  const pdfjsLib = await ensurePdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
  const pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    pages.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  return pages;
}

// Print an application (BBF claim / scholarship app) as a clean, branded
// document with its attachments embedded inline so the whole file prints as one
// job. Images and PDF pages are all embedded as data: images (PDFs rendered via
// PDF.js) so everything prints reliably. Attachments are fetched as blobs
// (auth-protected) and rendered into a fresh window.
// opts = { heading, subheading, sections:[{title, rows:[[k, vHtml], …]}], documents:[{label, file_url}], footer }
async function printApplication(opts) {
  const { heading = 'Application', subheading = '', sections = [], documents = [], footer = '' } = opts || {};
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow pop-ups for this site to print.'); return; }
  w.document.write('<!doctype html><meta charset="utf-8"><title>' + escHtml(heading) +
    '</title><body style="font-family:Arial,sans-serif;padding:2rem;color:#333">Preparing document &amp; attachments…</body>');
  w.document.close();

  // Pull each attachment as a blob (needs the Bearer token) and turn it into one
  // or more data: images: image files directly, PDFs page-by-page via PDF.js.
  // Each entry is { label, src } (a data URL) or { label, error, note }.
  const atts = [];
  for (const d of documents) {
    try {
      const blob = await fetchDocBlob(d.file_url);
      const isPdf = /pdf/i.test(blob.type) || /\.pdf(\?|$)/i.test(d.file_url || '');
      if (isPdf) {
        try {
          const pages = await pdfToImageDataUrls(blob);
          if (!pages.length) throw new Error('empty pdf');
          pages.forEach((src, i) => atts.push({
            label: d.label + (pages.length > 1 ? ` — page ${i + 1} of ${pages.length}` : ''),
            src,
          }));
        } catch (_) {
          atts.push({ label: d.label, error: true, note: 'This PDF could not be rendered for printing.' });
        }
      } else {
        atts.push({ label: d.label, src: await blobToDataUrl(blob) });
      }
    } catch (_) {
      atts.push({ label: d.label, error: true });
    }
  }

  const sectionsHtml = sections.map(s => `
    <div class="sec">
      <h2>${escHtml(s.title)}</h2>
      <table>${s.rows.map(([k, v]) => `<tr><td class="k">${escHtml(k)}</td><td>${v == null || v === '' ? '—' : v}</td></tr>`).join('')}</table>
    </div>`).join('');

  const attsHtml = atts.map(a => a.error
    ? `<div class="att"><h2>${escHtml(a.label)}</h2><p class="err">${escHtml(a.note || 'This attachment could not be loaded.')}</p></div>`
    : `<div class="att"><h2>${escHtml(a.label)}</h2><img src="${a.src}" alt="${escHtml(a.label)}"></div>`
  ).join('');

  const attIntro = documents.length
    ? `<div class="sec"><h2>Attachments (${documents.length})</h2><p class="muted">Each attachment is reproduced on its own page below.</p></div>`
    : `<div class="sec"><h2>Attachments</h2><p class="muted">No attachments on file.</p></div>`;

  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(heading)}</title>
    <style>
      @page { margin: 1.4cm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color:#1A202C; margin:0; }
      .head { display:flex; align-items:center; gap:1rem; border-bottom:3px solid #1B3A6E; padding-bottom:0.9rem; margin-bottom:1.4rem; }
      .head img { height:54px; width:auto; }
      .head h1 { font-size:1.25rem; margin:0 0 0.15rem; color:#1B3A6E; }
      .head .sub { font-size:0.85rem; color:#718096; }
      .head .org { margin-left:auto; text-align:right; font-size:0.72rem; color:#718096; line-height:1.5; }
      .sec { margin-bottom:1.15rem; }
      .sec h2 { font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; color:#718096;
                border-bottom:2px solid #C8962A; display:inline-block; padding-bottom:0.2rem; margin:0 0 0.55rem; }
      table { width:100%; border-collapse:collapse; font-size:0.85rem; }
      td { padding:0.32rem 0; vertical-align:top; }
      td.k { color:#718096; width:38%; }
      .muted { color:#718096; font-size:0.82rem; }
      .err { color:#991B1B; font-size:0.82rem; }
      .att { page-break-before: always; }
      .att img { max-width:100%; height:auto; display:block; margin-top:0.5rem; }
      .foot { margin-top:1.5rem; padding-top:0.8rem; border-top:1px solid #e2e8f0; font-size:0.72rem; color:#718096; }
    </style></head>
    <body>
      <div class="head">
        <img src="/images/kuppetlogo.png" alt="KUPPET" onerror="this.style.display='none'">
        <div><h1>${escHtml(heading)}</h1>${subheading ? `<div class="sub">${escHtml(subheading)}</div>` : ''}</div>
        <div class="org">KUPPET Migori Branch<br>Cosade Building, 3rd Floor, Migori Town<br>info@kuppetmigori.co.ke</div>
      </div>
      ${sectionsHtml}
      ${attIntro}
      ${attsHtml}
      <div class="foot">Printed ${escHtml(new Date().toLocaleString('en-KE'))} · KUPPET Migori administrative record${footer ? ' · ' + escHtml(footer) : ''}</div>
      <script>
        window.addEventListener('load', function(){ setTimeout(function(){ window.focus(); window.print(); }, 400); });
      <\/script>
    </body></html>`);
  w.document.close();
}
window.printApplication = printApplication;

function formatDate(d, opts = {}) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', ...opts });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatMoney(n) {
  if (n == null) return '—';
  return 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status) {
  if (!status) return '';
  const label = status.replace(/_/g, ' ');
  return `<span class="status-badge status-badge--${escHtml(status)}">${escHtml(label)}</span>`;
}

function bbfTypeLabel(t) { return ({ death: 'Death', retirement: 'Retirement' })[t] || (t || '').replace(/_/g, ' '); }
function bbfSchoolCatLabel(c) { return ({ senior_school: 'Senior School', junior_school: 'Junior School' })[c] || '—'; }

function renderLoading() {
  return `<div class="portal-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>`;
}

function renderEmpty(msg = 'No records found') {
  return `<div class="portal-empty"><i class="fas fa-inbox"></i><h3>${escHtml(msg)}</h3></div>`;
}

// Reusable "N–M of T" + Prev/Next pager. Renders into #elId; calls onPage(newOffset)
// on click. Styles the container inline so pages only need an empty <div id=...>.
function renderAdminPager(elId, { total = 0, offset = 0, limit = 25, onPage }) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!total || total <= limit) { el.innerHTML = ''; el.style.cssText = ''; return; }
  el.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:0.5rem;padding:0.75rem 1rem;font-size:0.82rem;color:var(--text-muted)';
  const from = offset + 1, to = Math.min(offset + limit, total);
  el.innerHTML = `<span>${from}–${to} of ${total}</span>
    <span style="display:flex;gap:0.35rem">
      <button class="btn btn-outline btn-xs" ${offset === 0 ? 'disabled' : ''} data-pg="prev"><i class="fas fa-chevron-left"></i> Prev</button>
      <button class="btn btn-outline btn-xs" ${to >= total ? 'disabled' : ''} data-pg="next">Next <i class="fas fa-chevron-right"></i></button>
    </span>`;
  el.querySelector('[data-pg="prev"]').onclick = () => { if (offset > 0) onPage(Math.max(0, offset - limit)); };
  el.querySelector('[data-pg="next"]').onclick = () => { if (to < total) onPage(offset + limit); };
}

function showAlert(elId, msg, type = 'danger') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
}

function hideAlert(elId) {
  const el = document.getElementById(elId);
  if (el) el.className = 'hidden';
}

// ── Auth guard + idle timeout ───────────────────────────────────────────────
// Auto-logout after this many ms with no user activity (keep in sync with the
// inline <head> guard on every admin page).
const ADMIN_IDLE_MS = 30 * 60 * 1000; // 30 minutes

function adminIsIdle() {
  const la = parseInt(sessionStorage.getItem('adminLastActivity') || '0', 10);
  return la > 0 && Date.now() - la > ADMIN_IDLE_MS;
}

function requireAdminAuth() {
  const token = sessionStorage.getItem('adminToken');
  const user = adminApi.getUser();
  if (!token || !user || adminIsIdle()) {
    adminApi.clearAuth();
    window.location.href = '/admin/login.html';
    return null;
  }
  return user;
}

// Refresh the activity stamp on interaction, and periodically enforce the idle
// cutoff even when the user is sitting on a page without navigating.
function initIdleTimeout() {
  const touch = () => sessionStorage.setItem('adminLastActivity', String(Date.now()));
  touch();
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, touch, { passive: true }));
  setInterval(() => {
    if (sessionStorage.getItem('adminToken') && adminIsIdle()) {
      adminApi.clearAuth();
      window.location.href = '/admin/login.html';
    }
  }, 30 * 1000);
}

// Pages a content_admin may open (the Content section + their Account Security).
// Everything else redirects to content-news.html. Keep in sync with the
// data-content-ok nav items and the backend authorizeContent routes.
const CONTENT_ADMIN_PATHS = [
  '/admin/content-news.html', '/admin/content-events.html', '/admin/content-resources.html',
  '/admin/content-leadership.html', '/admin/content-scholarships.html', '/admin/content-advocacy.html',
  '/admin/content-announcements.html', '/admin/security.html',
];
function isContentAdminPathAllowed(path) {
  return CONTENT_ADMIN_PATHS.includes(path);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function initSidebar(user) {
  if (!user) return;

  // Set user display
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role.replace(/_/g, ' ');
  if (avatarEl) avatarEl.textContent = user.name ? user.name[0].toUpperCase() : 'A';

  // Hide super_admin-only items for every non-super role (branch_officer,
  // branch_secretary). This is cosmetic — the backend authorizeSuperAdmin
  // gate is what actually enforces access.
  if (user.role !== 'super_admin') {
    document.querySelectorAll('[data-super-only]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Court Cases are for branch officers + super_admin only; hide from other roles
  // (branch_secretary). Cosmetic — the backend authorizeCourt gate enforces it.
  if (!['super_admin', 'branch_officer'].includes(user.role)) {
    document.querySelectorAll('[data-court-only]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // content_admin: a content-only role. Hide every nav section/item except the
  // ones tagged data-content-ok (the Content pages + Account Security), and bounce
  // them off any page outside that allowlist. Cosmetic + navigational only — the
  // backend authorizeContent gate is what actually enforces access.
  if (user.role === 'content_admin') {
    document.querySelectorAll('.sidebar-nav-section, .sidebar-nav-item').forEach(el => {
      if (el.classList.contains('logout-btn')) return;      // keep Sign Out
      if (!el.hasAttribute('data-content-ok')) el.style.display = 'none';
    });
    if (!isContentAdminPathAllowed(window.location.pathname)) {
      window.location.replace('/admin/content-news.html');
      return;
    }
  }

  // Mark active nav item
  const current = window.location.pathname;
  document.querySelectorAll('.sidebar-nav-item[href]').forEach(link => {
    if (link.getAttribute('href') === current) link.classList.add('active');
  });

  // Mobile sidebar toggle
  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('portal-sidebar');
  const overlay = document.getElementById('portal-overlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('visible');
    });
    overlay && overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  // Logout
  document.querySelectorAll('.logout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      adminApi.clearAuth();
      window.location.href = '/admin/login.html';
    });
  });

  // Show the count of members awaiting approval on the sidebar nav badge.
  // content_admin has no member access (and the badge is hidden), so skip the
  // call to avoid a guaranteed 403 + audit-log noise.
  if (user.role !== 'content_admin') loadPendingBadge();
}

// Populate the "Pending Approval" sidebar badge (all admin roles can view members).
// Uses a limit:1 query — we only need the total. Fails silently.
async function loadPendingBadge() {
  const badge = document.getElementById('pending-count-badge');
  if (!badge) return;
  try {
    const res = await adminApi.members.getAll({ status: 'pending_approval', limit: 1, offset: 0 });
    const n = res.total || 0;
    if (n > 0) { badge.textContent = n > 99 ? '99+' : n; badge.style.display = ''; }
  } catch (_) { /* silent — badge stays hidden */ }
}

// ── Shared sidebar HTML ───────────────────────────────────────────────────────
function getSidebarHtml() {
  return `
<aside class="portal-sidebar" id="portal-sidebar">
  <a href="/admin/dashboard.html" class="sidebar-brand">
    <img src="/images/kuppetlogo.png" class="sidebar-brand-img" alt="KUPPET">
    <div class="sidebar-brand-text">
      <strong>KUPPET Migori</strong>
      <span>Admin Portal</span>
    </div>
  </a>

  <div class="sidebar-user">
    <div class="sidebar-user-avatar" id="sidebar-user-avatar">A</div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name" id="sidebar-user-name">Admin</div>
      <div class="sidebar-user-role" id="sidebar-user-role">Administrator</div>
    </div>
  </div>

  <nav class="sidebar-nav">
    <div class="sidebar-nav-section">Overview</div>
    <a href="/admin/dashboard.html" class="sidebar-nav-item">
      <i class="fas fa-chart-pie"></i> Dashboard
    </a>

    <div class="sidebar-nav-section">Members</div>
    <a href="/admin/members.html" class="sidebar-nav-item">
      <i class="fas fa-users"></i> All Members
    </a>
    <a href="/admin/members.html?tab=pending" class="sidebar-nav-item">
      <i class="fas fa-user-clock"></i> Pending Approval
      <span class="nav-badge" id="pending-count-badge" style="display:none"></span>
    </a>

    <div class="sidebar-nav-section">Welfare</div>
    <a href="/admin/bbf.html" class="sidebar-nav-item">
      <i class="fas fa-hand-holding-heart"></i> BBF Claims
    </a>
    <a href="/admin/scholarship-apps.html" class="sidebar-nav-item">
      <i class="fas fa-award"></i> Scholarship Applications
    </a>

    <div class="sidebar-nav-section" data-content-ok>Content</div>
    <a href="/admin/content-news.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-newspaper"></i> News & Circulars
    </a>
    <a href="/admin/content-events.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-calendar-alt"></i> Events
    </a>
    <a href="/admin/content-resources.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-folder-open"></i> Resources
    </a>
    <a href="/admin/content-leadership.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-user-tie"></i> Leadership
    </a>
    <a href="/admin/content-scholarships.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-graduation-cap"></i> Scholarships
    </a>
    <a href="/admin/content-advocacy.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-gavel"></i> Advocacy
    </a>
    <a href="/admin/content-announcements.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-bullhorn"></i> Ticker Announcements
    </a>
    <a href="/admin/contacts.html" class="sidebar-nav-item">
      <i class="fas fa-envelope"></i> Contact Inbox
      <span class="nav-badge" id="new-contacts-badge" style="display:none"></span>
    </a>

    <div class="sidebar-nav-section" data-court-only>Legal</div>
    <a href="/admin/court-cases.html" class="sidebar-nav-item" data-court-only>
      <i class="fas fa-scale-balanced"></i> Court Cases
    </a>
    <a href="/admin/disciplinary-cases.html" class="sidebar-nav-item" data-court-only>
      <i class="fas fa-user-shield"></i> Disciplinary Cases
    </a>

    <div class="sidebar-nav-section">Communications</div>
    <a href="/admin/sms.html" class="sidebar-nav-item">
      <i class="fas fa-sms"></i> Send SMS
    </a>
    <a href="/admin/email.html" class="sidebar-nav-item">
      <i class="fas fa-envelope"></i> Send Email
    </a>
    <a href="/admin/sms-logs.html" class="sidebar-nav-item">
      <i class="fas fa-list-alt"></i> SMS Logs
    </a>
    <a href="/admin/email-logs.html" class="sidebar-nav-item">
      <i class="fas fa-envelope-open-text"></i> Email Logs
    </a>
    <a href="/admin/sms-templates.html" class="sidebar-nav-item">
      <i class="fas fa-file-alt"></i> SMS Templates
    </a>

    <div class="sidebar-nav-section" data-content-ok>Account</div>
    <a href="/admin/security.html" class="sidebar-nav-item" data-content-ok>
      <i class="fas fa-user-shield"></i> Account Security
    </a>

    <div class="sidebar-nav-section" data-super-only>Administration</div>
    <a href="/admin/audit-logs.html" class="sidebar-nav-item" data-super-only>
      <i class="fas fa-shield-alt"></i> Audit Logs
    </a>
    <a href="/admin/users.html" class="sidebar-nav-item" data-super-only>
      <i class="fas fa-user-cog"></i> Admin Users
    </a>
    <a href="/admin/settings.html" class="sidebar-nav-item" data-super-only>
      <i class="fas fa-cog"></i> Settings
    </a>
  </nav>

  <div class="sidebar-footer">
    <button class="logout-btn sidebar-nav-item" style="color:rgba(255,255,255,0.5)">
      <i class="fas fa-sign-out-alt"></i> Sign Out
    </button>
  </div>
</aside>
<div class="portal-overlay" id="portal-overlay"></div>`;
}

function getTopbarHtml(title) {
  return `
<div class="portal-topbar">
  <div class="topbar-left">
    <button class="sidebar-toggle topbar-icon-btn" id="sidebar-toggle">
      <i class="fas fa-bars"></i>
    </button>
    <span class="topbar-title">${escHtml(title)}</span>
  </div>
  <div class="topbar-right">
    <a href="/" target="_blank" class="topbar-icon-btn" title="View website">
      <i class="fas fa-external-link-alt"></i>
    </a>
    <button class="logout-btn topbar-icon-btn" title="Sign out">
      <i class="fas fa-sign-out-alt"></i>
    </button>
  </div>
</div>`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function initDashboard() {
  if (!document.querySelector('.admin-dashboard-page')) return;
  const user = requireAdminAuth();
  if (!user) return;
  initSidebar(user);

  try {
    const [summary, monthly] = await Promise.all([
      adminApi.analytics.getSummary(),
      adminApi.analytics.getMonthly(),
    ]);
    renderSummaryCards(summary.data || {});
    renderCharts(monthly.data || {});
  } catch (err) {
    console.error('Dashboard load failed:', err.message);
  }

  loadCourtSummary();
}

async function loadCourtSummary() {
  const el = document.getElementById('court-summary');
  if (!el) return;
  // Skip for roles without court access (branch_secretary) — the card is hidden anyway.
  const user = adminApi.getUser();
  if (!user || !['super_admin', 'branch_officer'].includes(user.role)) return;
  try {
    const res = await adminApi.courtCases.getStats();
    const d = res.data || {};
    const pill = (val, label, color) =>
      `<div style="flex:1;min-width:110px;text-align:center;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0.85rem">
         <div style="font-size:1.5rem;font-weight:800;color:${color}">${val}</div>
         <div style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em">${label}</div>
       </div>`;
    const hearings = (d.next_hearings || []).length
      ? `<div style="margin-top:1rem">
           <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.5rem">Upcoming Hearings</div>
           ${d.next_hearings.map(h => `
             <a href="/admin/court-case-detail.html?id=${h.id}" style="display:flex;justify-content:space-between;gap:0.5rem;padding:0.5rem 0;border-bottom:1px solid var(--border);font-size:0.85rem;text-decoration:none;color:inherit">
               <span><strong>${escHtml(h.title)}</strong>${h.court ? `<br><small style="color:var(--text-muted)">${escHtml(h.court)}</small>` : ''}</span>
               <span style="white-space:nowrap;color:var(--primary);font-weight:600">${formatDate(h.next_hearing_date)}</span>
             </a>`).join('')}
         </div>`
      : `<p style="margin-top:1rem;color:var(--text-muted);font-size:0.85rem">No upcoming hearings scheduled.</p>`;
    el.innerHTML =
      `<div style="display:flex;gap:0.75rem;flex-wrap:wrap">
         ${pill(d.active || 0, 'Active', 'var(--primary)')}
         ${pill(d.upcoming_hearings || 0, 'Upcoming Hearings', 'var(--gold)')}
         ${pill(d.closed || 0, 'Closed', 'var(--green)')}
       </div>${hearings}`;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem">Court case summary unavailable.</p>`;
  }
}

function renderSummaryCards(d) {
  const cards = [
    { id: 'stat-total-members',    value: d.total_members || 0,    label: 'Total Members',          icon: 'users',           color: 'blue' },
    { id: 'stat-active-members',   value: d.active_members || 0,   label: 'Active Members',         icon: 'user-check',      color: 'green' },
    { id: 'stat-pending',          value: d.pending_members || 0,  label: 'Member Requests',         icon: 'user-clock',      color: 'gold' },
    { id: 'stat-bbf-submitted',    value: d.bbf_submitted || 0,    label: 'BBF Claims Submitted',   icon: 'file-medical',    color: 'purple' },
    { id: 'stat-bbf-approved',     value: d.bbf_approved || 0,     label: 'BBF Claims Approved',    icon: 'check-circle',    color: 'green' },
    { id: 'stat-sch-applications', value: d.sch_applications || 0, label: 'Scholarship Applications',icon: 'award',          color: 'teal' },
    { id: 'stat-sms-sent',         value: d.sms_sent || 0,         label: 'SMS Sent This Month',    icon: 'sms',             color: 'gold' },
    { id: 'stat-new-contacts',     value: d.new_contacts || 0,     label: 'New Enquiries',           icon: 'envelope',       color: 'red' },
  ];
  const grid = document.getElementById('stats-grid');
  if (!grid) return;
  grid.innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="stat-icon ${c.color}"><i class="fas fa-${c.icon}"></i></div>
      <div class="stat-info">
        <div class="stat-value">${c.value.toLocaleString()}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    </div>`).join('');
}

function renderCharts(monthly) {
  if (typeof Chart === 'undefined') return;
  const months = monthly.labels || [];
  const memberData = monthly.members || [];
  const bbfData = monthly.bbf_claims || [];
  const smsData = monthly.sms || [];

  const opts = (label, data, color) => ({
    type: 'line',
    data: {
      labels: months,
      datasets: [{ label, data, borderColor: color, backgroundColor: color + '20', tension: 0.4, fill: true, pointRadius: 3 }],
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#f0f0f0' } }, x: { grid: { display: false } } } },
  });

  const memberCtx = document.getElementById('chart-members');
  if (memberCtx) new Chart(memberCtx, opts('New Members', memberData, '#1B3A6E'));
  const bbfCtx = document.getElementById('chart-bbf');
  if (bbfCtx) new Chart(bbfCtx, opts('BBF Claims', bbfData, '#C8962A'));
  const smsCtx = document.getElementById('chart-sms');
  if (smsCtx) new Chart(smsCtx, opts('SMS Sent', smsData, '#1a7340'));
}

// ── News admin ────────────────────────────────────────────────────────────────
async function initAdminNews() {
  if (!document.querySelector('.admin-news-page')) return;
  const user = requireAdminAuth();
  if (!user) return;
  initSidebar(user);
  loadNewsTable();
  document.getElementById('btn-new-news')?.addEventListener('click', () => openNewsModal(null));
}

const NEWS_LIMIT = 20;
const newsFilter = { category: '', search: '' };
let newsOffset = 0;
async function loadNewsTable(params = {}) {
  // Each inline handler passes only its own field; accumulate into persistent
  // state so category + search combine (and refreshes after save/delete keep it).
  // Changing a filter resets to the first page; page clicks pass an explicit offset.
  if ('category' in params) { newsFilter.category = params.category; newsOffset = 0; }
  if ('search' in params) { newsFilter.search = params.search; newsOffset = 0; }
  if ('offset' in params) newsOffset = params.offset;
  const tbody = document.getElementById('news-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">${renderLoading()}</td></tr>`;
  try {
    const query = { limit: NEWS_LIMIT, offset: newsOffset };
    if (newsFilter.category) query.category = newsFilter.category;
    if (newsFilter.search) query.search = newsFilter.search;
    const res = await adminApi.news.getAll(query);
    const pager = () => renderAdminPager('news-pager', { total: res.total || 0, offset: newsOffset, limit: NEWS_LIMIT, onPage: o => loadNewsTable({ offset: o }) });
    if (!res.data.length) { tbody.innerHTML = `<tr><td colspan="6">${renderEmpty()}</td></tr>`; pager(); return; }
    tbody.innerHTML = res.data.map(n => `
      <tr>
        <td><strong>${escHtml(n.title)}</strong><br><small class="text-muted">${escHtml(n.slug)}</small></td>
        <td><span class="badge badge-${n.category}">${escHtml(n.category)}</span></td>
        <td>${escHtml(n.author)}</td>
        <td>${statusBadge(n.is_published ? 'approved' : 'draft')}</td>
        <td>${formatDate(n.published_at)}</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="openNewsModal(${n.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-xs" style="background:#FEE2E2;color:#991B1B" onclick="deleteNews(${n.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('');
    pager();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="alert alert-danger">${escHtml(err.message)}</div></td></tr>`;
  }
}

// ── Rich-text WYSIWYG editor (news / advocacy content) ────────────────────────
// The admin edits in a live contenteditable surface — bold looks bold, lists look
// like lists — so a non-technical editor never sees raw HTML tags. The formatted
// HTML is mirrored into the hidden <textarea name="content"> (existing save/load
// code keeps working), and rendered + re-sanitized on the public site
// (backend/utils/sanitizeHtml.js). Wire via `.rt-toolbar[data-rt-target="<textarea id>"]`.
function rtExec(cmd) {
  switch (cmd) {
    case 'bold':         document.execCommand('bold'); break;
    case 'italic':       document.execCommand('italic'); break;
    case 'ol':           document.execCommand('insertOrderedList'); break;
    case 'ul':           document.execCommand('insertUnorderedList'); break;
    case 'align-left':   document.execCommand('justifyLeft'); break;
    case 'align-center': document.execCommand('justifyCenter'); break;
    case 'align-right':  document.execCommand('justifyRight'); break;
    case 'link': {
      const url = prompt('Link URL (https://…):', 'https://');
      if (url && url !== 'https://') document.execCommand('createLink', false, url);
      break;
    }
    default: break;
  }
}
// Legacy articles were typed as plain text (line breaks, no HTML tags) and would
// otherwise load as one blob. Convert them to paragraphs so they appear arranged
// the way they were typed; anything already containing block tags is left as-is.
function rtNormalize(html) {
  if (!html) return '';
  if (/<(p|div|ul|ol|li|h[1-6]|br|blockquote|table|figure)[\s>/]/i.test(html)) return html;
  return html.split(/\n{2,}/).map(b => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
}
// Reload the visible editor from its hidden textarea (call after code sets .value,
// e.g. opening a modal / form.reset()).
function refreshRichEditor(ta) {
  if (ta && ta._rtEditor) ta._rtEditor.innerHTML = rtNormalize(ta.value || '');
}
function initRichToolbars(root = document) {
  try { document.execCommand('styleWithCSS', false, true); } catch (e) { /* older browsers */ }
  root.querySelectorAll('.rt-toolbar').forEach(tb => {
    if (tb.dataset.rtInit) return;
    tb.dataset.rtInit = '1';
    const ta = document.getElementById(tb.dataset.rtTarget);
    if (!ta || ta._rtEditor) return;

    const ed = document.createElement('div');
    ed.className = 'rt-editor form-control';
    ed.contentEditable = 'true';
    ed.setAttribute('role', 'textbox');
    ed.setAttribute('aria-multiline', 'true');
    if (ta.hasAttribute('placeholder')) ed.dataset.placeholder = ta.getAttribute('placeholder');
    ta.style.display = 'none';
    ta.removeAttribute('required');           // we validate the mirrored value in JS
    ta.parentNode.insertBefore(ed, ta.nextSibling);
    ta._rtEditor = ed;
    ed.innerHTML = rtNormalize(ta.value || '');

    const sync = () => {
      const html = ed.innerHTML.trim();
      ta.value = (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') ? '' : html;
    };
    ed.addEventListener('input', sync);
    ed.addEventListener('blur', sync);
    tb.querySelectorAll('[data-rt]').forEach(btn => {
      btn.addEventListener('mousedown', e => e.preventDefault()); // keep the editor selection
      btn.addEventListener('click', () => { ed.focus(); rtExec(btn.dataset.rt); sync(); });
    });
  });
}

let editingNewsId = null;
function setNewsHint(elId, label, url, removeField) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!url) { el.innerHTML = ''; return; }
  el.innerHTML =
    `Current: <a href="${escHtml(url)}" target="_blank" rel="noopener">${escHtml(label || 'view')}</a> — choosing a new file replaces it.` +
    (removeField
      ? ` <label style="display:inline-flex;align-items:center;gap:.25rem;margin-left:.4rem;color:var(--red);cursor:pointer"><input type="checkbox" data-remove="${escHtml(removeField)}"> Remove</label>`
      : '');
}
async function openNewsModal(id) {
  editingNewsId = id;
  const modal = document.getElementById('news-modal');
  if (!modal) return;
  const form = document.getElementById('news-form');
  form.reset();
  document.getElementById('news-modal-title').textContent = id ? 'Edit Article' : 'New Article';
  document.getElementById('news-form-alert').className = 'hidden';
  ['news-image1-current', 'news-image2-current'].forEach(elId => setNewsHint(elId, '', ''));
  document.getElementById('news-document-current').textContent =
    'PDF, Word or image — up to 10 MB. Members can download it from the article.';

  if (id) {
    try {
      const { data: n } = await adminApi.news.getOne(id);
      form.querySelector('[name=title]').value = n.title || '';
      form.querySelector('[name=category]').value = n.category || 'news';
      form.querySelector('[name=author]').value = n.author || '';
      form.querySelector('[name=excerpt]').value = n.excerpt || '';
      form.querySelector('[name=content]').value = n.content || '';
      form.querySelector('[name=is_featured]').checked = !!n.is_featured;
      form.querySelector('[name=is_published]').checked = !!n.is_published;
      setNewsHint('news-image1-current', n.featured_image || '', n.featured_image, 'featured_image');
      setNewsHint('news-image2-current', n.image_2 || '', n.image_2, 'image_2');
      if (n.document_url) setNewsHint('news-document-current', n.document_name || 'attachment', n.document_url, 'document');
    } catch (err) {
      const alertEl = document.getElementById('news-form-alert');
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = 'Could not load this article: ' + err.message;
    }
  }
  refreshRichEditor(form.querySelector('[name=content]'));
  modal.classList.add('open');
}

async function saveNews() {
  const form = document.getElementById('news-form');
  const alertEl = document.getElementById('news-form-alert');
  alertEl.className = 'hidden';
  const title = form.querySelector('[name=title]').value.trim();
  const content = form.querySelector('[name=content]').value.trim();
  if (!title || !content) {
    alertEl.className = 'alert alert-danger';
    alertEl.textContent = 'Title and content are required';
    return;
  }
  const fd = new FormData();
  fd.append('title', title);
  fd.append('content', content);
  fd.append('excerpt', form.querySelector('[name=excerpt]').value.trim());
  fd.append('category', form.querySelector('[name=category]').value);
  fd.append('author', form.querySelector('[name=author]').value.trim());
  fd.append('is_featured', form.querySelector('[name=is_featured]').checked);
  fd.append('is_published', form.querySelector('[name=is_published]').checked);
  const image1 = form.querySelector('[name=image1]').files[0];
  const image2 = form.querySelector('[name=image2]').files[0];
  const doc = form.querySelector('[name=document]').files[0];
  if (image1) fd.append('image1', image1);
  if (image2) fd.append('image2', image2);
  if (doc) fd.append('document', doc);

  // Removals — an empty value clears the column (backend honours featured_image=''
  // etc.). Only applied when no replacement file was chosen for that slot.
  const removals = {};
  form.querySelectorAll('[data-remove]:checked').forEach(cb => { removals[cb.dataset.remove] = true; });
  if (removals.featured_image && !image1) fd.append('featured_image', '');
  if (removals.image_2 && !image2) fd.append('image_2', '');
  if (removals.document && !doc) { fd.append('document_url', ''); fd.append('document_name', ''); }

  try {
    if (editingNewsId) {
      await adminApi.news.update(editingNewsId, fd);
    } else {
      await adminApi.news.create(fd);
    }
    document.getElementById('news-modal').classList.remove('open');
    loadNewsTable();
  } catch (err) {
    alertEl.className = 'alert alert-danger';
    alertEl.textContent = err.message;
  }
}

async function deleteNews(id) {
  if (!confirm('Delete this article? This cannot be undone.')) return;
  try {
    await adminApi.news.remove(id);
    loadNewsTable();
  } catch (err) {
    alert(err.message);
  }
}

// ── Generic table loaders for Events, Resources, Scholarships, etc. ───────────
// (Reused across multiple pages via the same function signature)

async function initAdminEvents() {
  if (!document.querySelector('.admin-events-page')) return;
  const user = requireAdminAuth(); if (!user) return; initSidebar(user);
  loadEventsTable();
  document.getElementById('btn-new-event')?.addEventListener('click', () => openEventModal(null));
}

const EVENTS_LIMIT = 30;
let eventsOffset = 0;
async function loadEventsTable(params = {}) {
  if ('offset' in params) eventsOffset = params.offset;
  const tbody = document.getElementById('events-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">${renderLoading()}</td></tr>`;
  try {
    const res = await adminApi.events.getAll({ limit: EVENTS_LIMIT, offset: eventsOffset });
    const pager = () => renderAdminPager('events-pager', { total: res.total || 0, offset: eventsOffset, limit: EVENTS_LIMIT, onPage: o => loadEventsTable({ offset: o }) });
    if (!res.data.length) { tbody.innerHTML = `<tr><td colspan="6">${renderEmpty()}</td></tr>`; pager(); return; }
    tbody.innerHTML = res.data.map(e => `
      <tr>
        <td><strong>${escHtml(e.title)}</strong></td>
        <td><span class="badge">${escHtml(e.event_type)}</span></td>
        <td>${formatDate(e.event_date)}</td>
        <td>${escHtml(e.venue || '—')}</td>
        <td>${statusBadge(e.is_published ? 'approved' : 'draft')}</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="openEventModal(${e.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-xs" style="background:#FEE2E2;color:#991B1B" onclick="deleteEvent(${e.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('');
    pager();
  } catch (err) { tbody.innerHTML = `<tr><td colspan="6">${escHtml(err.message)}</td></tr>`; }
}

let editingEventId = null;
function openEventModal(id) {
  editingEventId = id;
  const modal = document.getElementById('event-modal');
  if (!modal) return;
  document.getElementById('event-modal-title').textContent = id ? 'Edit Event' : 'New Event';
  if (!id) document.getElementById('event-form').reset();
  modal.classList.add('open');
}

async function saveEvent() {
  const form = document.getElementById('event-form');
  const data = {};
  ['title','description','event_date','event_time','venue','venue_address','event_type','registration_link'].forEach(k => {
    const el = form.querySelector(`[name=${k}]`);
    if (el) data[k] = el.value.trim() || null;
  });
  ['is_featured','is_published'].forEach(k => {
    const el = form.querySelector(`[name=${k}]`);
    if (el) data[k] = el.checked;
  });
  try {
    editingEventId ? await adminApi.events.update(editingEventId, data) : await adminApi.events.create(data);
    document.getElementById('event-modal').classList.remove('open');
    loadEventsTable();
  } catch (err) { alert(err.message); }
}

async function deleteEvent(id) {
  if (!confirm('Delete this event?')) return;
  try { await adminApi.events.remove(id); loadEventsTable(); } catch (err) { alert(err.message); }
}

// ── Ticker announcements ──────────────────────────────────────────────────────
async function initAdminAnnouncements() {
  if (!document.querySelector('.admin-announcements-page')) return;
  const user = requireAdminAuth(); if (!user) return; initSidebar(user);
  loadAnnouncementsTable();
  document.getElementById('btn-new-announcement')?.addEventListener('click', () => openAnnouncementModal(null));
}

let announcementsCache = [];
async function loadAnnouncementsTable() {
  const tbody = document.getElementById('announcements-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5">${renderLoading()}</td></tr>`;
  try {
    const res = await adminApi.announcements.getAll();
    announcementsCache = res.data;
    if (!res.data.length) { tbody.innerHTML = `<tr><td colspan="5">${renderEmpty()}</td></tr>`; return; }
    tbody.innerHTML = res.data.map(a => `
      <tr>
        <td style="width:3rem">${a.sort_order}</td>
        <td><strong>${escHtml(a.text)}</strong></td>
        <td>${a.link ? `<a href="${escHtml(a.link)}" target="_blank">${escHtml(a.link)}</a>` : '<span class="text-muted">—</span>'}</td>
        <td>${statusBadge(a.is_active ? 'approved' : 'draft')}</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="openAnnouncementModal(${a.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-xs" style="background:#FEE2E2;color:#991B1B" onclick="deleteAnnouncement(${a.id})"><i class="fas fa-trash"></i></button>
        </td>
      </tr>`).join('');
  } catch (err) { tbody.innerHTML = `<tr><td colspan="5">${escHtml(err.message)}</td></tr>`; }
}

let editingAnnouncementId = null;
function openAnnouncementModal(id) {
  editingAnnouncementId = id;
  const modal = document.getElementById('announcement-modal');
  if (!modal) return;
  const form = document.getElementById('announcement-form');
  form.reset();
  document.getElementById('announcement-modal-title').textContent = id ? 'Edit Announcement' : 'New Announcement';
  if (id) {
    const a = announcementsCache.find(x => x.id === id);
    if (a) {
      form.querySelector('[name=text]').value = a.text || '';
      form.querySelector('[name=link]').value = a.link || '';
      form.querySelector('[name=sort_order]').value = a.sort_order ?? 0;
      form.querySelector('[name=is_active]').checked = !!a.is_active;
    }
  } else {
    form.querySelector('[name=is_active]').checked = true;
  }
  modal.classList.add('open');
}

async function saveAnnouncement() {
  const form = document.getElementById('announcement-form');
  const data = {
    text: form.querySelector('[name=text]').value.trim(),
    link: form.querySelector('[name=link]').value.trim() || null,
    sort_order: parseInt(form.querySelector('[name=sort_order]').value, 10) || 0,
    is_active: form.querySelector('[name=is_active]').checked,
  };
  if (!data.text) { alert('Announcement text is required'); return; }
  try {
    editingAnnouncementId ? await adminApi.announcements.update(editingAnnouncementId, data) : await adminApi.announcements.create(data);
    document.getElementById('announcement-modal').classList.remove('open');
    loadAnnouncementsTable();
  } catch (err) { alert(err.message); }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try { await adminApi.announcements.remove(id); loadAnnouncementsTable(); } catch (err) { alert(err.message); }
}

// ── Contacts inbox ────────────────────────────────────────────────────────────
const contactsFilter = { status: '', category: '' };
async function initAdminContacts() {
  if (!document.querySelector('.admin-contacts-page')) return;
  const user = requireAdminAuth(); if (!user) return; initSidebar(user);
  // Advocacy reports are for branch_officer + super_admin only; hide the filter
  // chip from other roles (branch_secretary). Backend also filters them out.
  if (!['super_admin', 'branch_officer'].includes(user.role)) {
    document.querySelectorAll('[data-advocacy-only]').forEach(el => { el.style.display = 'none'; });
  }
  // Honour a ?status= deep-link (e.g. the dashboard "View New Enquiries" action).
  const urlStatus = new URLSearchParams(window.location.search).get('status');
  if (urlStatus) {
    contactsFilter.status = urlStatus;
    document.querySelectorAll('#status-filters .filter-tab').forEach(t => {
      t.classList.toggle('active', (t.dataset.status || '') === urlStatus);
    });
  }
  loadContactsTable();
  // Status and category are two independent filter rows; each keeps one active
  // tab within its own row and both dimensions are combined in the query.
  document.querySelectorAll('#status-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#status-filters .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contactsFilter.status = tab.dataset.status || '';
      contactsOffset = 0;
      loadContactsTable();
    });
  });
  document.querySelectorAll('#category-filters .filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#category-filters .filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      contactsFilter.category = tab.dataset.category || '';
      contactsOffset = 0;
      loadContactsTable();
    });
  });
}

let contactsCache = [];
const CONTACTS_LIMIT = 30;
let contactsOffset = 0;
async function loadContactsTable() {
  const tbody = document.getElementById('contacts-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6">${renderLoading()}</td></tr>`;
  try {
    const query = { limit: CONTACTS_LIMIT, offset: contactsOffset };
    if (contactsFilter.status) query.status = contactsFilter.status;
    if (contactsFilter.category) query.category = contactsFilter.category;
    const res = await adminApi.contacts.getAll(query);
    contactsCache = res.data;
    const pager = () => renderAdminPager('contacts-pager', { total: res.total || 0, offset: contactsOffset, limit: CONTACTS_LIMIT, onPage: o => { contactsOffset = o; loadContactsTable(); } });
    if (!res.data.length) { tbody.innerHTML = `<tr><td colspan="6">${renderEmpty()}</td></tr>`; pager(); return; }
    tbody.innerHTML = res.data.map(c => `
      <tr>
        <td><strong>${escHtml(c.name)}</strong><br><small>${escHtml(c.email)}</small></td>
        <td>${escHtml(c.phone || '—')}</td>
        <td><span class="badge">${escHtml(c.category)}</span></td>
        <td title="${escHtml(c.message)}">${escHtml(c.message.substring(0, 60))}…</td>
        <td>${statusBadge(c.status)}</td>
        <td>
          <div style="display:flex;gap:0.4rem;align-items:center">
            <button class="btn btn-gold btn-xs" onclick="openReplyModal(${c.id})" title="Email a reply"><i class="fas fa-reply"></i> Reply</button>
            <select class="form-control" style="padding:0.3rem;font-size:0.75rem" onchange="updateContactStatus(${c.id},this.value)">
              <option value="new" ${c.status==='new'?'selected':''}>New</option>
              <option value="read" ${c.status==='read'?'selected':''}>Read</option>
              <option value="replied" ${c.status==='replied'?'selected':''}>Replied</option>
              <option value="closed" ${c.status==='closed'?'selected':''}>Closed</option>
            </select>
          </div>
        </td>
      </tr>`).join('');
    pager();
  } catch (err) { tbody.innerHTML = `<tr><td colspan="6">${escHtml(err.message)}</td></tr>`; }
}

async function updateContactStatus(id, status) {
  try { await adminApi.contacts.updateStatus(id, status); } catch (err) { alert(err.message); }
}

let replyingContactId = null;
function openReplyModal(id) {
  const c = contactsCache.find(x => x.id === id);
  if (!c) return;
  replyingContactId = id;
  const fmt = c.created_at ? new Date(c.created_at).toLocaleString('en-KE') : '';
  document.getElementById('reply-context').innerHTML = `
    <div><strong>${escHtml(c.name)}</strong> &lt;${escHtml(c.email)}&gt;${c.phone ? ' · ' + escHtml(c.phone) : ''}</div>
    <div style="color:var(--text-muted);margin:0.25rem 0"><span class="badge">${escHtml(c.category)}</span>${c.subject ? ' · ' + escHtml(c.subject) : ''}${fmt ? ' · ' + escHtml(fmt) : ''}</div>
    <div style="margin-top:0.4rem;white-space:pre-wrap">${escHtml(c.message)}</div>`;
  const alertEl = document.getElementById('reply-alert');
  alertEl.className = 'hidden';
  const form = document.getElementById('reply-form');
  form.reset();
  // Pre-fill replies that were already sent so they can be reviewed/edited
  if (c.admin_reply) form.querySelector('[name=reply]').value = c.admin_reply;
  document.getElementById('reply-modal').classList.add('open');
}

async function sendReply() {
  const alertEl = document.getElementById('reply-alert');
  const btn = document.getElementById('reply-send-btn');
  const message = document.getElementById('reply-form').querySelector('[name=reply]').value.trim();
  alertEl.className = 'hidden';
  if (!message) {
    alertEl.className = 'alert alert-danger';
    alertEl.textContent = 'Please type a reply before sending.';
    return;
  }
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
  try {
    const res = await adminApi.contacts.reply(replyingContactId, message);
    document.getElementById('reply-modal').classList.remove('open');
    loadContactsTable();
    if (typeof showToast === 'function') showToast(res.message);
  } catch (err) {
    alertEl.className = 'alert alert-danger';
    alertEl.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

// ── Settings page ─────────────────────────────────────────────────────────────
async function initAdminSettings() {
  if (!document.querySelector('.admin-settings-page')) return;
  const user = requireAdminAuth(); if (!user) return; initSidebar(user);
  loadSettings();
}

// Account Security page — 2FA + password change, available to every admin role
async function initAdminSecurity() {
  if (!document.querySelector('.admin-security-page')) return;
  const user = requireAdminAuth(); if (!user) return; initSidebar(user);
  init2FASection();
}

async function loadSettings() {
  try {
    const res = await adminApi.settings.getAll();
    (res.data || []).forEach(s => {
      const el = document.querySelector(`[data-setting="${s.setting_key}"]`);
      if (el) el.value = s.setting_value;
    });
  } catch (err) { console.error('Settings load:', err.message); }
}

async function saveSetting(key) {
  const el = document.querySelector(`[data-setting="${key}"]`);
  if (!el) return;
  try {
    await adminApi.settings.update(key, el.value);
    showAlert('settings-alert', 'Saved successfully', 'success');
  } catch (err) { showAlert('settings-alert', err.message); }
}

async function init2FASection() {
  try {
    const res = await adminApi.auth.me();
    const enabled = res.data?.twofa_enabled;
    const statusEl = document.getElementById('twofa-status');
    if (statusEl) statusEl.innerHTML = enabled
      ? `<span class="status-badge status-badge--approved">Enabled</span>`
      : `<span class="status-badge status-badge--pending">Not enabled</span>`;
    document.getElementById('btn-setup-2fa') && (document.getElementById('btn-setup-2fa').style.display = enabled ? 'none' : '');
    document.getElementById('btn-disable-2fa') && (document.getElementById('btn-disable-2fa').style.display = enabled ? '' : 'none');
  } catch (_) {}
}

async function setup2FA() {
  try {
    const res = await adminApi.auth.setup2fa();
    document.getElementById('qr-code-img').src = res.qrCode;
    document.getElementById('manual-key').textContent = res.manualKey;
    document.getElementById('setup-2fa-panel').style.display = 'block';
    document.getElementById('backup-codes').textContent = res.backupCodes.join('  |  ');
  } catch (err) { alert(err.message); }
}

async function enable2FA() {
  const code = document.getElementById('totp-setup-code').value.trim();
  try {
    await adminApi.auth.enable2fa(code);
    showAlert('settings-alert', '2FA enabled successfully', 'success');
    document.getElementById('setup-2fa-panel').style.display = 'none';
    init2FASection();
  } catch (err) { showAlert('settings-alert', err.message); }
}

async function disable2FA() {
  if (!confirm('Disable 2FA? This reduces account security.')) return;
  try {
    await adminApi.auth.disable2fa();
    showAlert('settings-alert', '2FA disabled', 'success');
    init2FASection();
  } catch (err) { showAlert('settings-alert', err.message); }
}

// ── DOMContentLoaded ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('adminToken')) initIdleTimeout();
  initDashboard();
  initAdminNews();
  initAdminEvents();
  initAdminAnnouncements();
  initAdminContacts();
  initAdminSettings();
  initAdminSecurity();
  initRichToolbars();

  // Close modals on overlay click
  document.querySelectorAll('.portal-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.portal-modal-overlay')?.classList.remove('open');
    });
  });
});
