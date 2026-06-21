/* KUPPET Migori — Member API Client */
const memberApi = (() => {
  const BASE = '/api';

  function getToken()  { return localStorage.getItem('memberToken'); }
  function saveToken(t){ localStorage.setItem('memberToken', t); }
  function saveMember(m){ localStorage.setItem('memberUser', JSON.stringify(m)); }
  function getMember() { try { return JSON.parse(localStorage.getItem('memberUser')); } catch { return null; } }
  function clearAuth() { localStorage.removeItem('memberToken'); localStorage.removeItem('memberUser'); }

  function getCsrf() {
    const m = document.cookie.match(/__csrf=([^;]+)/);
    return m ? m[1] : '';
  }

  async function request(path, options = {}) {
    const token = getToken();
    const headers = { ...options.headers };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.method && options.method !== 'GET') headers['X-CSRF-Token'] = getCsrf();

    const res = await fetch(BASE + path, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      clearAuth();
      window.location.href = '/member/login.html';
      return;
    }
    if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
    return data;
  }

  return {
    getToken, saveToken, saveMember, getMember, clearAuth,

    auth: {
      login: (tsc_number, password) => request('/member/auth/login', { method: 'POST', body: JSON.stringify({ tsc_number, password }) }),
      register: (formData) => request('/member/auth/register', { method: 'POST', body: formData }),
      me: () => request('/member/auth/me'),
      changePassword: (oldPassword, newPassword) => request('/member/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
    },

    profile: {
      get: () => request('/member/profile'),
      update: (d) => request('/member/profile', { method: 'PUT', body: JSON.stringify(d) }),
      uploadPhoto: (form) => request('/member/profile/photo', { method: 'POST', body: form }),
    },

    bbf: {
      getAll: () => request('/member/bbf'),
      create: (d) => request('/member/bbf', { method: 'POST', body: JSON.stringify(d) }),
      getOne: (id) => request(`/member/bbf/${id}`),
      submit: (id) => request(`/member/bbf/${id}/submit`, { method: 'POST', body: '{}' }),
      uploadDocs: (id, form) => request(`/member/bbf/${id}/documents`, { method: 'POST', body: form }),
      getTimeline: (id) => request(`/member/bbf/${id}/timeline`),
    },

    scholarships: {
      getAvailable: () => request('/member/scholarships'),
      apply: (id, form) => request(`/member/scholarships/${id}/apply`, { method: 'POST', body: form }),
      getApplications: () => request('/member/scholarships/applications'),
      getOneApplication: (id) => request(`/member/scholarships/applications/${id}`),
    },

    notifications: {
      getAll: (p = {}) => request('/member/notifications?' + new URLSearchParams(p)),
      markRead: (id) => request(`/member/notifications/${id}/read`, { method: 'PUT', body: '{}' }),
      markAllRead: () => request('/member/notifications/read-all', { method: 'PUT', body: '{}' }),
    },

    document: (filename) => `/api/member/documents/${encodeURIComponent(filename)}`,
  };
})();
