/* KUPPET Migori — Member Portal Logic */

function escHtml(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-KE', {day:'numeric',month:'short',year:'numeric'}); }
function formatDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('en-KE', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }

function statusBadge(s) {
  if (!s) return '';
  return `<span class="status-badge status-badge--${escHtml(s)}">${escHtml(s.replace(/_/g,' '))}</span>`;
}

// Passport photos live in the access-controlled members/ upload dir and are
// streamed from /api/member/documents/:filename behind the member Bearer token.
// A CSS background-image / <img src> GET can't carry that header, so fetch the
// file with the token and hand back a data: URL (the site CSP allows data: for
// images, but not blob:). Returns '' on any failure so callers can no-op.
async function fetchMemberDocDataUrl(fileUrlOrName) {
  try {
    const filename = String(fileUrlOrName).split('/').pop();
    const token = sessionStorage.getItem('memberToken');
    const res = await fetch('/api/member/documents/' + encodeURIComponent(filename), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return '';
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve('');
      fr.readAsDataURL(blob);
    });
  } catch { return ''; }
}

// Load the member's passport photo into #profile-photo (clearing the placeholder
// icon on success).
async function renderProfilePhoto(fileUrlOrName) {
  const el = document.getElementById('profile-photo');
  if (!el || !fileUrlOrName) return;
  const dataUrl = await fetchMemberDocDataUrl(fileUrlOrName);
  if (!dataUrl) return;
  el.style.backgroundImage = `url(${dataUrl})`;
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.innerHTML = '';
}

// Auto-logout after this many ms with no user activity (keep in sync with the
// inline <head> guard on every member page).
const MEMBER_IDLE_MS = 30 * 60 * 1000; // 30 minutes

function memberIsIdle() {
  const la = parseInt(sessionStorage.getItem('memberLastActivity') || '0', 10);
  return la > 0 && Date.now() - la > MEMBER_IDLE_MS;
}

function requireMemberAuth() {
  if (!sessionStorage.getItem('memberToken') || !memberApi.getMember() || memberIsIdle()) {
    memberApi.clearAuth();
    window.location.href = '/member/login.html';
    return null;
  }
  return memberApi.getMember();
}

// Force bulk-imported members through onboarding before they reach the portal:
// (1) set a real password (must_change_password), then (2) complete their
// profile (onboarding_complete). Existing members default to complete, so this
// is a no-op for them. Runs on every portal page except the two onboarding pages.
async function enforceMemberOnboarding() {
  if (!sessionStorage.getItem('memberToken')) return;
  const path = window.location.pathname;
  const onFirstLogin = /\/first-login\.html$/.test(path);
  const onProfile = /\/profile\.html$/.test(path);
  let me;
  try { me = (await memberApi.auth.me()).data; } catch { return; }
  if (me.must_change_password) {
    if (!onFirstLogin) window.location.replace('/member/first-login.html');
    return;
  }
  if (me.onboarding_complete === false && !onProfile) {
    window.location.replace('/member/profile.html');
  }
}

// Refresh the activity stamp on interaction, and periodically enforce the idle
// cutoff even when the member is sitting on a page without navigating.
function initMemberIdleTimeout() {
  const touch = () => sessionStorage.setItem('memberLastActivity', String(Date.now()));
  touch();
  ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, touch, { passive: true }));
  setInterval(() => {
    if (sessionStorage.getItem('memberToken') && memberIsIdle()) {
      memberApi.clearAuth();
      window.location.href = '/member/login.html';
    }
  }, 30 * 1000);
}

function initMemberSidebar(member) {
  if (!member) return;
  const nameEl = document.getElementById('sb-member-name');
  const numEl  = document.getElementById('sb-member-number');
  const avEl   = document.getElementById('sb-avatar');
  if (nameEl) nameEl.textContent = member.full_name;
  if (numEl)  numEl.textContent  = member.member_number;
  if (avEl)   avEl.textContent   = member.full_name ? member.full_name[0].toUpperCase() : 'M';

  const current = window.location.pathname;
  document.querySelectorAll('.sidebar-nav-item[href]').forEach(l => {
    if (l.getAttribute('href') === current) l.classList.add('active');
  });

  const toggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('portal-sidebar');
  const overlay = document.getElementById('portal-overlay');
  if (toggle && sidebar) {
    toggle.addEventListener('click', () => { sidebar.classList.toggle('open'); overlay?.classList.toggle('visible'); });
    overlay?.addEventListener('click', () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); });
  }

  document.querySelectorAll('.logout-btn').forEach(b => b.addEventListener('click', () => {
    memberApi.clearAuth(); window.location.href = '/member/login.html';
  }));
}

function getMemberSidebarHtml() {
  return `
<aside class="portal-sidebar" id="portal-sidebar">
  <a href="/member/dashboard.html" class="sidebar-brand">
    <img src="/images/kuppetlogo.png" class="sidebar-brand-img" alt="KUPPET">
    <div class="sidebar-brand-text"><strong>KUPPET Migori</strong><span>Member Portal</span></div>
  </a>
  <div class="sidebar-user">
    <div class="sidebar-user-avatar" id="sb-avatar">M</div>
    <div class="sidebar-user-info">
      <div class="sidebar-user-name" id="sb-member-name">Member</div>
      <div class="sidebar-user-role" id="sb-member-number"></div>
    </div>
  </div>
  <nav class="sidebar-nav">
    <a href="/member/dashboard.html" class="sidebar-nav-item"><i class="fas fa-home"></i> Dashboard</a>
    <a href="/member/profile.html" class="sidebar-nav-item"><i class="fas fa-user"></i> My Profile</a>
    <div class="sidebar-nav-section">Welfare Services</div>
    <a href="/member/bbf-claims.html" class="sidebar-nav-item"><i class="fas fa-hand-holding-heart"></i> BBF Claims</a>
    <a href="/member/scholarships.html" class="sidebar-nav-item"><i class="fas fa-award"></i> Scholarships</a>
    <a href="/member/scholarship-applications.html" class="sidebar-nav-item"><i class="fas fa-file-alt"></i> My Applications</a>
    <div class="sidebar-nav-section">Account</div>
    <a href="/member/notifications.html" class="sidebar-nav-item"><i class="fas fa-bell"></i> Notifications <span class="nav-badge" id="notif-badge" style="display:none"></span></a>
    <a href="/member/history.html" class="sidebar-nav-item"><i class="fas fa-history"></i> Activity History</a>
  </nav>
  <div class="sidebar-footer">
    <a href="/" class="sidebar-nav-item" style="color:rgba(255,255,255,0.5)"><i class="fas fa-globe"></i> Public Website</a>
    <button class="logout-btn sidebar-nav-item" style="color:rgba(255,255,255,0.5)"><i class="fas fa-sign-out-alt"></i> Sign Out</button>
  </div>
</aside>
<div class="portal-overlay" id="portal-overlay"></div>`;
}

function getMemberTopbarHtml(title) {
  return `
<div class="portal-topbar">
  <div class="topbar-left">
    <button class="sidebar-toggle topbar-icon-btn" id="sidebar-toggle"><i class="fas fa-bars"></i></button>
    <span class="topbar-title">${escHtml(title)}</span>
  </div>
  <div class="topbar-right">
    <a href="/member/notifications.html" class="topbar-icon-btn" title="Notifications">
      <i class="fas fa-bell"></i>
      <span class="topbar-notif-dot" id="notif-dot" style="display:none"></span>
    </a>
    <button class="logout-btn topbar-icon-btn" title="Sign out"><i class="fas fa-sign-out-alt"></i></button>
  </div>
</div>`;
}

async function loadNotifCount() {
  try {
    const res = await memberApi.notifications.getAll({ limit: 1 });
    const count = res.unreadCount || 0;
    const badge = document.getElementById('notif-badge');
    const dot = document.getElementById('notif-dot');
    if (count > 0) {
      if (badge) { badge.style.display = ''; badge.textContent = count; }
      if (dot) dot.style.display = '';
    }
  } catch (_) {}
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function initMemberDashboard() {
  if (!document.querySelector('.member-dashboard-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member);
  loadNotifCount();

  document.getElementById('dash-name').textContent = member.full_name.split(' ')[0];
  document.getElementById('dash-member-number').textContent = member.member_number;

  try {
    const [bbfRes, schRes, notifRes] = await Promise.all([
      memberApi.bbf.getAll().catch(() => ({ data: [] })),
      memberApi.scholarships.getApplications().catch(() => ({ data: [] })),
      memberApi.notifications.getAll({ limit: 5 }).catch(() => ({ data: [], unreadCount: 0 })),
    ]);
    document.getElementById('dash-bbf-count').textContent = bbfRes.data.length;
    document.getElementById('dash-sch-count').textContent = schRes.data.length;
    document.getElementById('dash-notif-count').textContent = notifRes.unreadCount || 0;
    renderRecentNotifications(notifRes.data.slice(0, 4));
  } catch (_) {}
}

function renderRecentNotifications(notifs) {
  const el = document.getElementById('recent-notifs');
  if (!el) return;
  if (!notifs.length) { el.innerHTML = '<div class="portal-empty" style="padding:1.5rem"><p>No notifications yet</p></div>'; return; }
  el.innerHTML = notifs.map(n => `
    <div style="padding:0.75rem 1.25rem;border-bottom:1px solid var(--border);display:flex;gap:0.75rem;align-items:flex-start${!n.is_read ? ';background:#FAFBFF' : ''}">
      <div style="width:8px;height:8px;border-radius:50%;background:${!n.is_read ? 'var(--primary)' : 'transparent'};margin-top:6px;flex-shrink:0"></div>
      <div>
        <div style="font-size:0.82rem;font-weight:${!n.is_read ? '600' : '400'}">${escHtml(n.title)}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.15rem">${formatDateTime(n.created_at)}</div>
      </div>
    </div>`).join('');
}

// Friendly labels for the required-profile fields (used in the onboarding banner).
const PROFILE_FIELD_LABELS = {
  phone: 'Phone number', email: 'Email', gender: 'Gender', date_of_birth: 'Date of birth',
  school_name: 'School name', sub_county: 'Sub-county', school_category: 'Category (senior/junior)',
  job_group: 'Job group',
};
function showOnboardingBanner(missing) {
  const banner = document.getElementById('onboarding-banner');
  if (!banner) return;
  banner.classList.remove('hidden');
  const list = (missing || []).map(f => PROFILE_FIELD_LABELS[f] || f);
  const el = document.getElementById('onboarding-missing');
  if (el) el.textContent = list.length ? ` Still needed: ${list.join(', ')}.` : '';
}

// ── Profile ───────────────────────────────────────────────────────────────────
async function initMemberProfile() {
  if (!document.querySelector('.member-profile-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member);
  loadNotifCount();

  try {
    const res = await memberApi.profile.get();
    const m = res.data;
    const fields = ['full_name','tsc_number','national_id','employment_number','phone','email','gender','date_of_birth','school_name','sub_county','school_category','job_group'];
    fields.forEach(f => {
      const el = document.getElementById(`p-${f.replace(/_/g,'-')}`);
      if (el) el.value = m[f] || '';
    });
    // Imported sub-counties (e.g. "Nyatike") may not be one of the 12 canonical
    // dropdown options — keep the stored value visible (as a flagged option) so
    // it isn't silently overwritten, prompting the member to pick the exact one.
    const scEl = document.getElementById('p-sub-county');
    if (scEl && m.sub_county && scEl.value !== m.sub_county) {
      const opt = new Option(`${m.sub_county} — please reselect`, m.sub_county, true, true);
      scEl.add(opt, scEl.firstChild);
    }
    document.getElementById('p-member-number').textContent = m.member_number;
    document.getElementById('p-status').innerHTML = statusBadge(m.status);
    document.getElementById('p-joined').textContent = formatDate(m.created_at);
    if (m.passport_photo_url) {
      renderProfilePhoto(m.passport_photo_url);
    }
    // First-login onboarding: show which fields still need filling.
    if (m.onboarding_complete === false) showOnboardingBanner(m.missing_fields || []);
  } catch (err) {
    showMsg('profile-msg', err.message);
  }

  document.getElementById('btn-save-profile')?.addEventListener('click', async () => {
    try {
      const res = await memberApi.profile.update({
        phone: document.getElementById('p-phone').value.trim(),
        email: document.getElementById('p-email').value.trim(),
        gender: document.getElementById('p-gender').value,
        date_of_birth: document.getElementById('p-date-of-birth').value,
        school_name: document.getElementById('p-school-name').value.trim(),
        sub_county: document.getElementById('p-sub-county').value,
        school_category: document.getElementById('p-school-category').value,
        job_group: document.getElementById('p-job-group').value,
        employment_number: document.getElementById('p-employment-number').value.trim(),
      });
      if (res.onboarding_complete) {
        showMsg('profile-msg', 'Profile complete! Taking you to your dashboard…', 'success');
        setTimeout(() => window.location.href = '/member/dashboard.html', 1200);
      } else if (res.profile_complete === false) {
        showOnboardingBanner(res.missing_fields || []);
        showMsg('profile-msg', 'Saved. Please fill the remaining required fields.', 'success');
      } else {
        showMsg('profile-msg', 'Profile updated successfully', 'success');
      }
    } catch (err) { showMsg('profile-msg', err.message); }
  });

  document.getElementById('photo-input')?.addEventListener('change', async function() {
    if (!this.files[0]) return;
    const form = new FormData();
    form.append('photo', this.files[0]);
    try {
      const res = await memberApi.profile.uploadPhoto(form);
      showMsg('profile-msg', 'Photo updated', 'success');
      if (res?.data?.url) await renderProfilePhoto(res.data.url);
    } catch (err) {
      showMsg('profile-msg', err.message);
    } finally {
      this.value = ''; // allow re-selecting the same file to retry
    }
  });

  document.getElementById('btn-change-pw')?.addEventListener('click', async () => {
    const old = document.getElementById('old-pw').value;
    const nw  = document.getElementById('new-pw').value;
    try {
      await memberApi.auth.changePassword(old, nw);
      showMsg('pw-msg', 'Password changed', 'success');
      document.getElementById('old-pw').value = '';
      document.getElementById('new-pw').value = '';
    } catch (err) { showMsg('pw-msg', err.message); }
  });
}

// ── BBF Claims ────────────────────────────────────────────────────────────────
async function initMemberBbf() {
  if (!document.querySelector('.member-bbf-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member); loadNotifCount();

  loadBbfList();
  loadMyDetailsForClaim();
  document.getElementById('btn-new-claim')?.addEventListener('click', () => {
    document.getElementById('new-claim-modal').classList.add('open');
    document.getElementById('new-claim-form').reset();
    toggleDeathFields();
  });
  document.getElementById('claim-type')?.addEventListener('change', toggleDeathFields);
  document.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', () => b.closest('.portal-modal-overlay').classList.remove('open')));
  document.getElementById('btn-create-claim')?.addEventListener('click', createClaim);
}

// Show the member's own identity in the claim form (from their profile — never re-entered).
async function loadMyDetailsForClaim() {
  try {
    const { data: m } = await memberApi.profile.get();
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || '—'; };
    set('my-name', m.full_name);
    set('my-tsc', m.tsc_number);
    set('my-subcounty', m.sub_county);
    set('my-school', m.school_name);
    set('my-category', bbfSchoolCatLabel(m.school_category));
  } catch { /* read-only display; ignore */ }
}

// Death claims also need the deceased's name, relationship and date of death; retirement claims do not.
function toggleDeathFields() {
  const type = document.getElementById('claim-type')?.value;
  const deathFields = document.getElementById('death-only-fields');
  if (deathFields) deathFields.style.display = type === 'death' ? '' : 'none';
}

function bbfTypeLabel(t) { return ({ death: 'Death', retirement: 'Retirement' })[t] || (t || '').replace(/_/g, ' '); }
function bbfSchoolCatLabel(c) { return ({ senior_school: 'Senior School', junior_school: 'Junior School', tertiary_school: 'Tertiary School' })[c] || '—'; }

// Renders a titled block of label/value rows for the claim detail view.
function renderClaimSection(title, rows) {
  return `
    <div style="margin-bottom:1.25rem">
      <div style="font-size:0.72rem;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--text-muted);border-bottom:2px solid var(--gold);display:inline-block;padding-bottom:0.25rem;margin-bottom:0.75rem">${title}</div>
      <table style="width:100%;font-size:0.85rem;border-collapse:collapse">
        ${rows.map(([k, v]) => `<tr><td style="padding:0.4rem 0;color:var(--text-muted);width:45%">${k}</td><td style="font-weight:600">${v || '—'}</td></tr>`).join('')}
      </table>
    </div>`;
}

async function loadBbfList() {
  const el = document.getElementById('bbf-list');
  if (!el) return;
  el.innerHTML = '<div class="portal-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const res = await memberApi.bbf.getAll();
    if (!res.data.length) { el.innerHTML = `<div class="portal-empty"><i class="fas fa-inbox"></i><h3>No BBF claims yet</h3><p>Submit your first claim using the button above.</p></div>`; return; }
    el.innerHTML = res.data.map(c => `
      <div class="data-card" style="margin-bottom:0.75rem">
        <div style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
          <div>
            <div style="font-size:0.9rem;font-weight:700">${escHtml(c.claim_number)}</div>
            <div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(bbfTypeLabel(c.claim_type))} — ${formatDate(c.created_at)}</div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem">
            ${statusBadge(c.status)}
            <a href="/member/bbf-claim-detail.html?id=${c.id}" class="btn btn-outline btn-xs"><i class="fas fa-eye"></i> View</a>
          </div>
        </div>
      </div>`).join('');
  } catch (err) { el.innerHTML = `<div class="alert alert-danger">${escHtml(err.message)}</div>`; }
}

async function createClaim() {
  const type = document.getElementById('claim-type').value;
  const payload = {
    claim_type: type,
    deceased_name: document.getElementById('claim-name').value.trim(),
    relationship: document.getElementById('claim-relationship').value.trim(),
    date_of_death: document.getElementById('claim-dod').value || null,
  };
  if (!type) { showMsg('claim-msg', 'Claim type required'); return; }
  if (type === 'death' && (!payload.deceased_name || !payload.relationship || !payload.date_of_death)) {
    showMsg('claim-msg', 'Name of deceased, relationship and date of death are required for a death claim'); return;
  }
  try {
    const res = await memberApi.bbf.create(payload);
    document.getElementById('new-claim-modal').classList.remove('open');
    window.location.href = `/member/bbf-claim-detail.html?id=${res.data.id}`;
  } catch (err) { showMsg('claim-msg', err.message); }
}

// ── BBF Claim Detail ──────────────────────────────────────────────────────────
// Required documents differ by claim type (see submitClaim on the backend).
const BBF_DOC_SLOTS_DEATH = [
  { type: 'tsc_slip',              label: 'TSC Slip',             required: true,  note: null },
  { type: 'burial_permit',         label: 'Burial Permit',        required: true,  note: null },
  { type: 'birth_notification',    label: 'Birth Notification',   required: false, note: 'For Children' },
  { type: 'letter_from_principal', label: 'Letter From Principal',required: true,  note: null },
];
const BBF_DOC_SLOTS_RETIREMENT = [
  { type: 'tsc_slip',                        label: 'TSC Slip',                        required: true, note: null },
  { type: 'letter_of_compulsory_retirement', label: 'Letter of Compulsory Retirement', required: true, note: null },
];
function bbfDocSlotsFor(claimType) {
  return claimType === 'retirement' ? BBF_DOC_SLOTS_RETIREMENT : BBF_DOC_SLOTS_DEATH;
}

function renderBbfDocSlots(docs, isDraft, claimType) {
  return bbfDocSlotsFor(claimType).map(slot => {
    const uploaded = docs.find(d => d.doc_type === slot.type);
    return `
      <div class="doc-slot">
        <div class="doc-slot-info">
          <span class="doc-slot-name">
            <i class="fas fa-file-alt"></i>
            ${escHtml(slot.label)}${slot.required ? ' <span class="required">*</span>' : ''}
            ${slot.note ? `<span class="doc-slot-note">(${escHtml(slot.note)})</span>` : ''}
          </span>
          <div class="doc-slot-status">
            ${uploaded
              ? `<span class="doc-uploaded"><i class="fas fa-check-circle"></i> ${escHtml(uploaded.file_name || uploaded.file_url)}</span>`
              : `<span class="doc-not-uploaded"><i class="fas fa-times-circle"></i> Not uploaded</span>`}
          </div>
        </div>
        ${isDraft ? `
        <div class="doc-slot-upload">
          <input type="file" id="doc-file-${slot.type}" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" style="display:none">
          <button class="btn btn-outline btn-xs" id="doc-choose-${slot.type}"><i class="fas fa-paperclip"></i> Choose</button>
          <span class="doc-slot-filename" id="doc-fname-${slot.type}"></span>
          <button class="btn btn-gold btn-xs" id="doc-upload-${slot.type}"><i class="fas fa-upload"></i> Upload</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

async function initMemberBbfDetail() {
  if (!document.querySelector('.member-bbf-detail-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member); loadNotifCount();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { window.location.href = '/member/bbf-claims.html'; return; }

  loadClaimDetail(id);
  document.getElementById('btn-submit-claim')?.addEventListener('click', () => submitClaim(id));
}

async function loadClaimDetail(id) {
  try {
    const res = await memberApi.bbf.getOne(id);
    const c = res.data;
    document.getElementById('claim-number').textContent = c.claim_number;

    const claimRows = [
      ['Type', escHtml(bbfTypeLabel(c.claim_type))],
      ['Status', statusBadge(c.status)],
      ['Date Created', formatDate(c.created_at)],
    ];
    if (c.amount_approved) claimRows.push(['Amount Approved', `KES ${Number(c.amount_approved).toLocaleString()}`]);

    // Applicant = the member who filed the claim
    const applicantRows = [
      ['Name', escHtml(c.applicant_name || '—')],
      ['Member No', escHtml(c.applicant_member_number || '—')],
      ['TSC No', escHtml(c.tsc_no || '—')],
      ['ID No', escHtml(c.applicant_national_id || '—')],
      ['Phone', escHtml(c.applicant_phone || '—')],
      ['Email', escHtml(c.applicant_email || '—')],
      ['Sub-County', escHtml(c.sub_county || '—')],
      ['School', escHtml(c.school || '—')],
      ['Category', escHtml(bbfSchoolCatLabel(c.school_category))],
    ];

    let html = renderClaimSection('Claim', claimRows) + renderClaimSection("Applicant's Details", applicantRows);
    if (c.claim_type === 'death') {
      html += renderClaimSection('Deceased Person Details', [
        ['Name', escHtml(c.deceased_name || '—')],
        ['Relationship with Applicant', escHtml(c.relationship || '—')],
        ['Date of Death', formatDate(c.date_of_death)],
      ]);
    }
    document.getElementById('claim-details').innerHTML = html;

    // Show submit button only for drafts
    const isDraft = c.status === 'draft';
    const submitBtn = document.getElementById('btn-submit-claim');
    if (submitBtn) submitBtn.style.display = isDraft ? '' : 'none';

    // Document slots
    const slotsEl = document.getElementById('doc-slots');
    if (slotsEl) {
      slotsEl.innerHTML = renderBbfDocSlots(c.documents, isDraft, c.claim_type);
      if (isDraft) {
        bbfDocSlotsFor(c.claim_type).forEach(slot => {
          const chooseBtn = document.getElementById(`doc-choose-${slot.type}`);
          const fileInput = document.getElementById(`doc-file-${slot.type}`);
          const uploadBtn = document.getElementById(`doc-upload-${slot.type}`);
          if (chooseBtn && fileInput) {
            chooseBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', () => {
              const fnEl = document.getElementById(`doc-fname-${slot.type}`);
              if (fnEl) fnEl.textContent = fileInput.files[0]?.name || '';
            });
          }
          if (uploadBtn) uploadBtn.addEventListener('click', () => uploadBbfDoc(id, slot.type));
        });
      }
    }

    // Timeline
    const tlRes = await memberApi.bbf.getTimeline(id);
    const tl = document.getElementById('timeline');
    if (tl) {
      tl.innerHTML = tlRes.data.map(e => `
        <div class="timeline-item status-${e.to_status}">
          <div class="timeline-dot"><i class="fas fa-circle" style="font-size:0.5rem"></i></div>
          <div class="timeline-content">
            <div class="timeline-status">${escHtml(e.to_status.replace(/_/g,' '))}</div>
            <div class="timeline-meta">${formatDateTime(e.created_at)} — by ${escHtml(e.changed_by_type)}</div>
            ${e.comment ? `<div class="timeline-comment">${escHtml(e.comment)}</div>` : ''}
          </div>
        </div>`).join('');
    }
  } catch (err) { showMsg('detail-msg', err.message); }
}

async function submitClaim(id) {
  if (!confirm('Submit this claim for review? You will not be able to edit it after submission.')) return;
  try {
    await memberApi.bbf.submit(id);
    showMsg('detail-msg', 'Claim submitted successfully', 'success');
    loadClaimDetail(id);
  } catch (err) { showMsg('detail-msg', err.message); }
}

async function uploadBbfDoc(id, docType) {
  const inp = document.getElementById(`doc-file-${docType}`);
  if (!inp || !inp.files[0]) { showMsg('doc-msg', 'Please choose a file first'); return; }
  const form = new FormData();
  form.append('files', inp.files[0]);
  form.append('doc_type', docType);
  try {
    await memberApi.bbf.uploadDocs(id, form);
    showMsg('doc-msg', 'Document uploaded', 'success');
    loadClaimDetail(id);
  } catch (err) { showMsg('doc-msg', err.message); }
}

// ── Scholarships ──────────────────────────────────────────────────────────────
async function initMemberScholarships() {
  if (!document.querySelector('.member-scholarships-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member); loadNotifCount();

  const el = document.getElementById('scholarships-list');
  if (!el) return;
  el.innerHTML = '<div class="portal-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const res = await memberApi.scholarships.getAvailable();
    if (!res.data.length) { el.innerHTML = `<div class="portal-empty"><i class="fas fa-award"></i><h3>No scholarships available</h3><p>Check back later for new opportunities.</p></div>`; return; }
    el.innerHTML = res.data.map(s => `
      <div class="data-card" style="margin-bottom:1rem">
        <div style="padding:1.25rem">
          <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.75rem">
            <div><div style="font-size:1rem;font-weight:700">${escHtml(s.title)}</div><div style="font-size:0.8rem;color:var(--text-muted)">${escHtml(s.provider)}</div></div>
            ${s.application_deadline ? `<span style="font-size:0.78rem;color:var(--red);font-weight:600"><i class="fas fa-clock"></i> Deadline: ${formatDate(s.application_deadline)}</span>` : ''}
          </div>
          <p style="font-size:0.85rem;margin:0 0 0.75rem">${escHtml(s.description)}</p>
          <button class="btn btn-gold btn-sm" onclick="openApplyModal(${s.id},'${escHtml(s.title)}')"><i class="fas fa-paper-plane"></i> Apply Now</button>
        </div>
      </div>`).join('');
  } catch (err) { el.innerHTML = `<div class="alert alert-danger">${escHtml(err.message)}</div>`; }
}

let applyScholarshipId = null;
async function openApplyModal(id, title) {
  applyScholarshipId = id;
  document.getElementById('apply-scholarship-title').textContent = title;
  document.getElementById('apply-form').reset();
  document.getElementById('apply-modal').classList.add('open');
  // Applicant identity comes in full from the member's profile — read-only, never re-entered.
  try {
    const { data: m } = await memberApi.profile.get();
    const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.textContent = v || '—'; };
    set('sa-name', m.full_name);
    set('sa-memberno', m.member_number);
    set('sa-tsc', m.tsc_number);
    set('sa-phone', m.phone);
    set('sa-email', m.email);
    set('sa-subcounty', m.sub_county);
    set('sa-school', m.school_name);
    set('sa-category', bbfSchoolCatLabel(m.school_category));
  } catch { /* read-only display; ignore fetch errors */ }
}

async function submitApplication() {
  const form = document.getElementById('apply-form');
  // Native validation covers all the required text/number fields and the file inputs.
  if (!form.reportValidity()) return;
  const letter = document.getElementById('apply-letter');
  const tsc = document.getElementById('apply-tsc');
  if (!letter.files.length || !tsc.files.length) {
    return showMsg('apply-msg', 'Please attach both the Letter of Application and the TSC Slip.');
  }
  const formData = new FormData(form);
  formData.append('letter_of_application', letter.files[0]);
  formData.append('tsc_slip', tsc.files[0]);
  try {
    await memberApi.scholarships.apply(applyScholarshipId, formData);
    document.getElementById('apply-modal').classList.remove('open');
    showMsg('sch-msg', 'Application submitted successfully', 'success');
  } catch (err) { showMsg('apply-msg', err.message); }
}

// ── Scholarship Applications list ─────────────────────────────────────────────
async function initScholarshipApplications() {
  if (!document.querySelector('.member-schapp-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member); loadNotifCount();

  const el = document.getElementById('applications-list');
  if (!el) return;
  el.innerHTML = '<div class="portal-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const res = await memberApi.scholarships.getApplications();
    if (!res.data.length) { el.innerHTML = `<div class="portal-empty"><i class="fas fa-file-alt"></i><h3>No applications yet</h3><p><a href="/member/scholarships.html">Browse available scholarships</a></p></div>`; return; }
    el.innerHTML = res.data.map(a => `
      <div class="data-card" style="margin-bottom:0.75rem">
        <div style="padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
          <div>
            <div style="font-weight:700;font-size:0.9rem">${escHtml(a.scholarship_title)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">${escHtml(a.application_number)} — Applicant: ${escHtml(a.applicant_name)}</div>
            <div style="font-size:0.75rem;color:var(--text-muted)">${formatDate(a.created_at)}</div>
          </div>
          ${statusBadge(a.status)}
        </div>
      </div>`).join('');
  } catch (err) { el.innerHTML = `<div class="alert alert-danger">${escHtml(err.message)}</div>`; }
}

// ── Notifications ─────────────────────────────────────────────────────────────
async function initMemberNotifications() {
  if (!document.querySelector('.member-notifications-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member);

  loadNotifications();
  document.getElementById('btn-mark-all')?.addEventListener('click', async () => {
    await memberApi.notifications.markAllRead().catch(() => {});
    loadNotifications();
  });
}

async function loadNotifications() {
  const el = document.getElementById('notif-list');
  if (!el) return;
  el.innerHTML = '<div class="portal-loading"><i class="fas fa-spinner fa-spin"></i> Loading…</div>';
  try {
    const res = await memberApi.notifications.getAll({ limit: 50 });
    if (!res.data.length) { el.innerHTML = `<div class="portal-empty"><i class="fas fa-bell"></i><h3>No notifications</h3></div>`; return; }
    el.innerHTML = res.data.map(n => `
      <div style="padding:1rem 1.25rem;border-bottom:1px solid var(--border);display:flex;gap:1rem;align-items:flex-start;cursor:pointer${!n.is_read ? ';background:#F8FAFE' : ''}" onclick="markNotifRead(${n.id}, this)">
        <div style="width:10px;height:10px;border-radius:50%;background:${!n.is_read ? 'var(--primary)' : 'transparent'};border:2px solid var(--border);flex-shrink:0;margin-top:4px"></div>
        <div style="flex:1">
          <div style="font-size:0.85rem;font-weight:${!n.is_read ? '600' : '400'}">${escHtml(n.title)}</div>
          ${n.body ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.2rem">${escHtml(n.body)}</div>` : ''}
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.3rem">${formatDateTime(n.created_at)}</div>
        </div>
      </div>`).join('');
  } catch (err) { el.innerHTML = `<div class="alert alert-danger">${escHtml(err.message)}</div>`; }
}

async function markNotifRead(id, el) {
  await memberApi.notifications.markRead(id).catch(() => {});
  el.style.background = '';
  el.querySelector('div:first-child').style.background = 'transparent';
}

// ── History ───────────────────────────────────────────────────────────────────
async function initMemberHistory() {
  if (!document.querySelector('.member-history-page')) return;
  const member = requireMemberAuth(); if (!member) return;
  initMemberSidebar(member); loadNotifCount();

  try {
    const [bbfRes, schRes] = await Promise.all([
      memberApi.bbf.getAll().catch(() => ({ data: [] })),
      memberApi.scholarships.getApplications().catch(() => ({ data: [] })),
    ]);
    renderHistoryTable('bbf-history-tbody', bbfRes.data, ['claim_number','claim_type','status','submitted_at','resolved_at']);
    renderHistoryTable('sch-history-tbody', schRes.data, ['application_number','scholarship_title','status','created_at','reviewed_at']);
  } catch (_) {}
}

function renderHistoryTable(tbodyId, rows, cols) {
  const el = document.getElementById(tbodyId);
  if (!el) return;
  if (!rows.length) { el.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:1.5rem;color:var(--text-muted)">No records</td></tr>'; return; }
  el.innerHTML = rows.map(r => `<tr>${cols.map(c => {
    const v = r[c];
    if (c === 'status') return `<td>${statusBadge(v)}</td>`;
    if (c === 'claim_type') return `<td>${escHtml(bbfTypeLabel(v))}</td>`;
    if (c.endsWith('_at') || c.endsWith('_date')) return `<td>${formatDate(v)}</td>`;
    return `<td>${escHtml(v||'—')}</td>`;
  }).join('')}</tr>`).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showMsg(id, msg, type = 'danger') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('memberToken')) initMemberIdleTimeout();
  enforceMemberOnboarding();
  initMemberDashboard();
  initMemberProfile();
  initMemberBbf();
  initMemberBbfDetail();
  initMemberScholarships();
  initScholarshipApplications();
  initMemberNotifications();
  initMemberHistory();

  document.querySelectorAll('.portal-modal-overlay').forEach(o => {
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
  });
  document.querySelectorAll('.modal-close-btn').forEach(b => {
    b.addEventListener('click', () => b.closest('.portal-modal-overlay')?.classList.remove('open'));
  });
});
