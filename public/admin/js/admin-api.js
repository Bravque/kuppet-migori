/* KUPPET Migori — Admin API Client
   Wraps all admin API calls. Reads JWT from localStorage.
   Redirects to /admin/login.html on 401. */

const adminApi = (() => {
  const BASE = '/api';

  function getToken() { return localStorage.getItem('adminToken'); }
  function saveToken(t) { localStorage.setItem('adminToken', t); }
  function saveUser(u) { localStorage.setItem('adminUser', JSON.stringify(u)); }
  function getUser() { try { return JSON.parse(localStorage.getItem('adminUser')); } catch { return null; } }
  function clearAuth() { localStorage.removeItem('adminToken'); localStorage.removeItem('adminUser'); }

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
    if (res.status === 401 || res.status === 403) {
      clearAuth();
      window.location.href = '/admin/login.html';
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
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
      create: (d) => request('/news', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/news/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/news/${id}`, { method: 'DELETE' }),
    },

    events: {
      getAll: (p = {}) => request('/events?' + new URLSearchParams(p)),
      create: (d) => request('/events', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/events/${id}`, { method: 'DELETE' }),
    },

    resources: {
      getAll: (p = {}) => request('/resources?' + new URLSearchParams(p)),
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

    contacts: {
      getAll: (p = {}) => request('/contact?' + new URLSearchParams(p)),
      updateStatus: (id, status) => request(`/contact/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
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
      exportExcel: () => window.open('/api/admin/members/export', '_blank'),
    },

    bbf: {
      getAll: (p = {}) => request('/admin/bbf?' + new URLSearchParams(p)),
      getOne: (id) => request(`/admin/bbf/${id}`),
      startReview: (id, notes) => request(`/admin/bbf/${id}/review`, { method: 'PUT', body: JSON.stringify({ notes }) }),
      approve: (id, amount, notes) => request(`/admin/bbf/${id}/approve`, { method: 'PUT', body: JSON.stringify({ amount, notes }) }),
      reject: (id, notes) => request(`/admin/bbf/${id}/reject`, { method: 'PUT', body: JSON.stringify({ notes }) }),
      markPaid: (id, ref) => request(`/admin/bbf/${id}/paid`, { method: 'PUT', body: JSON.stringify({ ref }) }),
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
      getTemplates: () => request('/admin/sms/templates'),
      createTemplate: (d) => request('/admin/sms/templates', { method: 'POST', body: JSON.stringify(d) }),
      updateTemplate: (id, d) => request(`/admin/sms/templates/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    },

    analytics: {
      getSummary: () => request('/admin/analytics/summary'),
      getMonthly: () => request('/admin/analytics/monthly'),
      exportPdf: () => window.open('/api/admin/analytics/export-pdf', '_blank'),
    },

    audit: {
      getAll: (p = {}) => request('/admin/audit?' + new URLSearchParams(p)),
      exportPdf: () => window.open('/api/admin/audit/export', '_blank'),
    },

    users: {
      getAll: () => request('/admin/users'),
      create: (d) => request('/admin/users', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
      remove: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
    },
  };
})();
