/* KUPPET Migori — Member API Client */
const memberApi = (() => {
  const BASE = '/api';

  // Token lives in sessionStorage (cleared when the browser/last tab closes), and
  // an idle timestamp forces logout after MEMBER_IDLE_MS of inactivity — for
  // members on shared computers. See the inline <head> guard on each member page
  // and initMemberIdleTimeout() in member-portal.js.
  function getToken()  { return sessionStorage.getItem('memberToken'); }
  function saveToken(t){ sessionStorage.setItem('memberToken', t); sessionStorage.setItem('memberLastActivity', String(Date.now())); }
  function saveMember(m){ sessionStorage.setItem('memberUser', JSON.stringify(m)); }
  function getMember() { try { return JSON.parse(sessionStorage.getItem('memberUser')); } catch { return null; } }
  function clearAuth() { sessionStorage.removeItem('memberToken'); sessionStorage.removeItem('memberUser'); sessionStorage.removeItem('memberLastActivity'); }

  function getCsrf() {
    const m = document.cookie.match(/__csrf=([^;]+)/);
    if (m) return m[1];
    // No server-issued CSRF cookie yet — this happens on entry pages that POST
    // before making any GET (e.g. registration on a fresh browser), so the
    // double-submit check would 403. Mint one client-side: the server only
    // compares cookie === header, and a self-issued token is equally safe (a
    // cross-origin attacker can neither read this cookie nor set the header).
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `__csrf=${token}; Path=/; SameSite=Strict${secure}`;
    return token;
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
    if (!res.ok) {
      // express-validator failures return { errors: [{ msg, path }] } with no
      // top-level `message`, so surface the first field error instead of a bare
      // "Error 400" that hides which field was rejected.
      const firstErr = Array.isArray(data.errors) && data.errors.length
        ? (data.errors[0].msg || data.errors[0].message)
        : null;
      const e = new Error(data.message || firstErr || `Error ${res.status}`);
      e.code = data.code; e.status = res.status;
      e.errors = data.errors;
      // Name of the input that was rejected, when the endpoint reports one — lets
      // the page highlight/focus it instead of only showing a banner.
      e.field = data.field || (Array.isArray(data.errors) && data.errors[0]?.path) || null;
      throw e;
    }
    return data;
  }

  return {
    getToken, saveToken, saveMember, getMember, clearAuth,

    auth: {
      login: (tsc_number, password) => request('/member/auth/login', { method: 'POST', body: JSON.stringify({ tsc_number, password }) }),
      forgotPassword: (identifier) => request('/member/auth/forgot-password', { method: 'POST', body: JSON.stringify({ tsc_number: identifier }) }),
      resetPassword: (token, password) => request('/member/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
      register: (formData) => request('/member/auth/register', { method: 'POST', body: formData }),
      me: () => request('/member/auth/me'),
      changePassword: (oldPassword, newPassword) => request('/member/auth/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) }),
      firstPassword: (newPassword) => request('/member/auth/first-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
    },

    profile: {
      get: () => request('/member/profile'),
      update: (d) => request('/member/profile', { method: 'PUT', body: JSON.stringify(d) }),
      uploadPhoto: (form) => request('/member/profile/photo', { method: 'POST', body: form }),
    },

    bbf: {
      getAll: () => request('/member/bbf'),
      create: (d) => request('/member/bbf', { method: 'POST', body: JSON.stringify(d) }),
      update: (id, d) => request(`/member/bbf/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
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
      reuploadDoc: (id, form) => request(`/member/scholarships/applications/${id}/documents`, { method: 'POST', body: form }),
    },

    notifications: {
      getAll: (p = {}) => request('/member/notifications?' + new URLSearchParams(p)),
      markRead: (id) => request(`/member/notifications/${id}/read`, { method: 'PUT', body: '{}' }),
      markAllRead: () => request('/member/notifications/read-all', { method: 'PUT', body: '{}' }),
    },

    document: (filename) => `/api/member/documents/${encodeURIComponent(filename)}`,
  };
})();
