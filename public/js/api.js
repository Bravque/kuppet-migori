/* KUPPET Migori - API Client */
const API_BASE = '/api';

const api = {
  async fetch(endpoint, options = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    // Guard the parse: a non-JSON body (proxy 502/504, HTML error page) must not throw
    // an "Unexpected token <" that masks the real status.
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  news: {
    getAll: (params = {}) => api.fetch('/news?' + new URLSearchParams(params)),
    getFeatured: () => api.fetch('/news/featured'),
    getOne: (slug) => api.fetch(`/news/${slug}`),
  },

  events: {
    getAll: (params = {}) => api.fetch('/events?' + new URLSearchParams(params)),
    getUpcoming: () => api.fetch('/events/upcoming'),
  },

  resources: {
    getAll: (params = {}) => api.fetch('/resources?' + new URLSearchParams(params)),
    download: (id) => api.fetch(`/resources/${id}/download`),
  },

  leadership: {
    getAll: (params = {}) => api.fetch('/leadership?' + new URLSearchParams(params)),
  },

  scholarships: {
    getAll: (params = {}) => api.fetch('/scholarships?' + new URLSearchParams(params)),
  },

  advocacy: {
    getAll: (params = {}) => api.fetch('/advocacy?' + new URLSearchParams(params)),
    getOne: (slug) => api.fetch(`/advocacy/${slug}`),
  },

  settings: {
    getStats: () => api.fetch('/settings/stats'),
  },

  contact: {
    submit: (data) => api.fetch('/contact', { method: 'POST', body: JSON.stringify(data) }),
  },
};

window.api = api;
