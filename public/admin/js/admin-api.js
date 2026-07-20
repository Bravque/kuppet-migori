/* KUPPET Migori — Admin API Client
   Wraps all admin API calls. Reads JWT from sessionStorage.
   Redirects to /admin/login.html on 401. */

const adminApi = (() => {
  const BASE = '/api';

  // Token lives in sessionStorage (cleared when the browser/last tab closes), and
  // an idle timestamp forces logout after ADMIN_IDLE_MS of inactivity. See the
  // inline guard in each admin page's <head> and touchActivity() in admin-portal.js.
  function getToken() { return sessionStorage.getItem('adminToken'); }
  function saveToken(t) { sessionStorage.setItem('adminToken', t); sessionStorage.setItem('adminLastActivity', String(Date.now())); }
  function saveUser(u) { sessionStorage.setItem('adminUser', JSON.stringify(u)); }
  function getUser() { try { return JSON.parse(sessionStorage.getItem('adminUser')); } catch { return null; } }
  function clearAuth() { sessionStorage.removeItem('adminToken'); sessionStorage.removeItem('adminUser'); sessionStorage.removeItem('adminLastActivity'); }

  function getCsrfToken() {
    const m = document.cookie.match(/__csrf=([^;]+)/);
    return m ? m[1] : '';
  }

  async function request(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = getCsrfToken();
    if (options.body instanceof FormData) delete headers['Content-Type'];

    const res = await fetch(BASE + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    // 401 = not authenticated (missing/expired token) → session is dead, log out.
    // 403 = authenticated but not authorized (e.g. branch_secretary hitting a
    // super_admin route) → keep the session and surface the message below.
    if (res.status === 401 && token) {
      clearAuth();
      window.location.href = '/admin/login.html';
      return;
    }
    if (!res.ok) {
      let msg = data.message || `Error ${res.status}`;
      if (Array.isArray(data.errors) && data.errors.length) {
        msg += ': ' + data.errors.map(e => e.message).join('; ');
      }
      throw new Error(msg);
    }
    return data;
  }

  // Authenticated file download. A plain window.open() can't send the
  // Authorization header, so exports must be fetched as a blob with the token.
  async function download(path, fallbackName) {
    const token = getToken();
    const res = await fetch(BASE + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (res.status === 401 && token) {
      clearAuth(); window.location.href = '/admin/login.html'; return;
    }
    if (!res.ok) {
      let msg = `Export failed (${res.status})`;
      try { msg = (await res.json()).message || msg; } catch {}
      throw new Error(msg);
    }
    const blob = await res.blob();
    let name = fallbackName;
    const cd = res.headers.get('Content-Disposition');
    const m = cd && cd.match(/filename="?([^"]+)"?/);
    if (m) name = m[1];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return {
    getUser, clearAuth, saveToken, saveUser,

    auth: {
      login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
      confirmTotp: (tempToken, totp) => request('/auth/2fa/confirm', { method: 'POST', body: JSON.stringify({ tempToken, totp }) }),
      me: () => request('/auth/me'),
      changePassword: (oldPassword, newPassword) => request('/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
      setup2fa: () => request('/auth/2fa/setup', { method: 'POST', body: '{}' }),
      enable2fa: (totp) => request('/auth/2fa/enable', { method: 'POST', body: JSON.stringify({ totp }) }),
      disable2fa: () => request('/auth/2fa/disable', { method: 'DELETE' }),
    },

    news: {
      getAll: (p = {}) => request('/news/admin/all?' + new URLSearchParams(p)),
      getOne: (id) => request(`/news/admin/${id}`),
      // form is a FormData (title, content, images, document…)
      create: (form) => request('/news', { method: 'POST', body: form }),
      update: (id, form) => request(`/news/${id}`, { method: 'PUT', body: form }),
      remove: (id) => request(`/news/${id}`, { method: 'DELETE' }),
    },

    events: {
      getAll: (p = {}) => request('/events?' + new URLSearchParams(p)),
      create: (d) => request('/events', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
    },

    resources: {
      getAll: (p = {}) => request('/resources/admin/all?' + new URLSearchParams(p)),
      create: (form) => request('/resources', { method: 'POST', body: form }),
      update: (id, form) => request(`/resources/${id}`, { method: 'PUT', body: form }),
      remove: (id) => request(`/resources/${id}`, { method: 'DELETE' }),
    },

    leadership: {
      getAll: () => request('/leadership'),
      create: (form) => request('/leadership', { method: 'POST', body: form }),
      update: (id, form) => request(`/leadership/${id}`, { method: 'PUT', body: form }),
      remove: (id) => request(`/leadership/${id}`, { method: 'DELETE' }),
    },

    scholarships: {
      getAll: (p = {}) => request('/scholarships?' + new URLSearchParams({ active: false, ...p })),
      create: (d) => request('/scholarships', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/scholarships/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/scholarships/${id}`, { method: 'DELETE' }),
    },

    advocacy: {
      getAll: (p = {}) => request('/advocacy?' + new URLSearchParams(p)),
      create: (d) => request('/advocacy', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/advocacy/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/advocacy/${id}`, { method: 'DELETE' }),
    },

    announcements: {
      getAll: () => request('/announcements/all'),
      create: (d) => request('/announcements', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
    },

    contacts: {
      getAll: (p = {}) => request('/contact?' + new URLSearchParams(p)),
      updateStatus: (id, status) => request(`/contact/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
      reply: (id, message) => request(`/contact/${id}/reply`, { method: 'POST', body: JSON.stringify({ message }) }),
    },

    settings: {
      getAll: () => request('/settings/all'),
      update: (key, value) => request(`/settings/${key}`, { method: 'PUT', body: JSON.stringify({ value }) }),
    },

    members: {
      getAll: (p = {}) => request('/admin/members?' + new URLSearchParams(p)),
      getOne: (id) => request(`/admin/members/${id}`),
      approve: (id) => request(`/admin/members/${id}/approve`, { method: 'PUT', body: '{}' }),
      reject: (id, reason) => request(`/admin/members/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
      suspend: (id, reason) => request(`/admin/members/${id}/suspend`, { method: 'PUT', body: JSON.stringify({ reason }) }),
      exportExcel: (p = {}) => download('/admin/members/export?' + new URLSearchParams(p), 'members.xlsx'),
    },

    bbf: {
      getAll: (p = {}) => request('/admin/bbf?' + new URLSearchParams(p)),
      getOne: (id) => request(`/admin/bbf/${id}`),
      startReview: (id, notes) => request(`/admin/bbf/${id}/review`, { method: 'PUT', body: JSON.stringify({ notes }) }),
      approve: (id, amount, notes) => request(`/admin/bbf/${id}/approve`, { method: 'PUT', body: JSON.stringify({ amount, notes }) }),
      reject: (id, notes) => request(`/admin/bbf/${id}/reject`, { method: 'PUT', body: JSON.stringify({ notes }) }),
      markPaid: (id, ref) => request(`/admin/bbf/${id}/paid`, { method: 'PUT', body: JSON.stringify({ ref }) }),
      exportExcel: (p = {}) => download('/admin/bbf/export?' + new URLSearchParams(p), 'bbf-claims.xlsx'),
    },

    schApps: {
      getAll: (p = {}) => request('/admin/scholarship-apps?' + new URLSearchParams(p)),
      getOne: (id) => request(`/admin/scholarship-apps/${id}`),
      approve: (id, notes) => request(`/admin/scholarship-apps/${id}/approve`, { method: 'PUT', body: JSON.stringify({ notes }) }),
      reject: (id, notes) => request(`/admin/scholarship-apps/${id}/reject`, { method: 'PUT', body: JSON.stringify({ notes }) }),
    },

    sms: {
      send: (d) => request('/admin/sms/send', { method: 'POST', body: JSON.stringify(d) }),
      bulk: (d) => request('/admin/sms/bulk', { method: 'POST', body: JSON.stringify(d) }),
      getLogs: (p = {}) => request('/admin/sms/logs?' + new URLSearchParams(p)),
      checkStatus: (id) => request(`/admin/sms/logs/${id}/check-status`, { method: 'POST' }),
      getTemplates: () => request('/admin/sms/templates'),
      createTemplate: (d) => request('/admin/sms/templates', { method: 'POST', body: JSON.stringify(d) }),
      updateTemplate: (id, d) => request(`/admin/sms/templates/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    },

    email: {
      send: (d) => request('/admin/email/send', { method: 'POST', body: JSON.stringify(d) }),
      bulk: (d) => request('/admin/email/bulk', { method: 'POST', body: JSON.stringify(d) }),
      group: (d) => request('/admin/email/group', { method: 'POST', body: JSON.stringify(d) }),
      getLogs: (p = {}) => request('/admin/email/logs?' + new URLSearchParams(p)),
    },

    analytics: {
      getSummary: () => request('/admin/analytics/summary'),
      getMonthly: () => request('/admin/analytics/monthly'),
      exportPdf: () => download('/admin/analytics/export-pdf', 'analytics-report.pdf'),
    },

    audit: {
      getAll: (p = {}) => request('/admin/audit?' + new URLSearchParams(p)),
      exportPdf: (p = {}) => download('/admin/audit/export?' + new URLSearchParams(p), 'audit-logs.pdf'),
    },

    users: {
      getAll: () => request('/admin/users'),
      create: (d) => request('/admin/users', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    },

    courtCases: {
      getAll: (p = {}) => request('/admin/court-cases?' + new URLSearchParams(p)),
      getStats: () => request('/admin/court-cases/stats'),
      getOne: (id) => request(`/admin/court-cases/${id}`),
      create: (d) => request('/admin/court-cases', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/admin/court-cases/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/admin/court-cases/${id}`, { method: 'DELETE' }),
      addUpdate: (id, d) => request(`/admin/court-cases/${id}/updates`, { method: 'POST', body: JSON.stringify(d) }),
      uploadDocs: (id, form) => request(`/admin/court-cases/${id}/documents`, { method: 'POST', body: form }),
      removeDoc: (id, docId) => request(`/admin/court-cases/${id}/documents/${docId}`, { method: 'DELETE' }),
    },

    disciplinaryCases: {
      getAll: (p = {}) => request('/admin/disciplinary-cases?' + new URLSearchParams(p)),
      getStats: () => request('/admin/disciplinary-cases/stats'),
      getOne: (id) => request(`/admin/disciplinary-cases/${id}`),
      create: (d) => request('/admin/disciplinary-cases', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/admin/disciplinary-cases/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/admin/disciplinary-cases/${id}`, { method: 'DELETE' }),
      addUpdate: (id, d) => request(`/admin/disciplinary-cases/${id}/updates`, { method: 'POST', body: JSON.stringify(d) }),
      uploadDocs: (id, form) => request(`/admin/disciplinary-cases/${id}/documents`, { method: 'POST', body: form }),
      removeDoc: (id, docId) => request(`/admin/disciplinary-cases/${id}/documents/${docId}`, { method: 'DELETE' }),
    },
  };
})();
