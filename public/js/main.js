/* KUPPET Migori - Main JavaScript */

// ============================================
// NAVIGATION
// ============================================
(function initNav() {
  const header = document.querySelector('.site-header');
  const hamburger = document.querySelector('.hamburger');
  const mainNav = document.querySelector('.main-nav');
  const overlay = document.querySelector('.nav-overlay');

  // Sticky header shadow
  if (header) {
    const scrollWatcher = () => {
      header.classList.toggle('scrolled', window.scrollY > 60);
    };
    window.addEventListener('scroll', scrollWatcher, { passive: true });
  }

  // Mobile menu toggle
  if (hamburger && mainNav) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      mainNav.classList.toggle('open', isOpen);
      if (overlay) overlay.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeMobileNav);
  }

  function closeMobileNav() {
    hamburger?.classList.remove('open');
    mainNav?.classList.remove('open');
    overlay?.classList.remove('open');
    document.body.style.overflow = '';
  }

  // Mobile dropdown toggles
  document.querySelectorAll('.dropdown .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 960) { // matches the CSS hamburger-drawer breakpoint
        e.preventDefault();
        const dropdown = link.closest('.dropdown');
        dropdown.classList.toggle('open');
      }
    });
  });

  // Active nav link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && (currentPath === href || (href !== '/' && currentPath.startsWith(href)))) {
      link.classList.add('active');
    }
  });

  // Close nav on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth > 960) closeMobileNav(); // matches CSS hamburger-drawer breakpoint
  });
})();

// ============================================
// SCROLL TO TOP
// ============================================
(function initScrollTop() {
  const btn = document.createElement('button');
  btn.className = 'scroll-top';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.innerHTML = '<i class="fas fa-chevron-up"></i>';
  document.body.appendChild(btn);

  const toggle = () => btn.classList.toggle('show', window.scrollY > 400);
  window.addEventListener('scroll', toggle, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// ============================================
// ANIMATED COUNTERS
// ============================================
function animateCounter(el, target, suffix = '') {
  const duration = 2000;
  const start = performance.now();
  const startVal = 0;

  const update = (time) => {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(startVal + (target - startVal) * eased);
    el.textContent = current.toLocaleString() + suffix;
    if (progress < 1) requestAnimationFrame(update);
  };

  requestAnimationFrame(update);
}

function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        const target = parseInt(entry.target.dataset.counter);
        const suffix = entry.target.dataset.suffix || '';
        animateCounter(entry.target, target, suffix);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(c => observer.observe(c));
}

// ============================================
// FADE IN ON SCROLL
// ============================================
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.news-card, .service-card, .event-card, .scholarship-card, .leader-card, .value-card, .resource-card, .advocacy-card').forEach(el => {
    observer.observe(el);
  });
}

// ============================================
// HOMEPAGE FUNCTIONS
// ============================================
async function loadHomepageData() {
  if (!document.querySelector('.home-page')) return;

  await Promise.allSettled([
    loadSiteStats(),
    loadFeaturedNews(),
    loadUpcomingEvents(),
  ]);
}

async function loadSiteStats() {
  try {
    const { data } = await api.settings.getStats();
    const map = {
      'total_members': '[data-stat="members"]',
      'schools_covered': '[data-stat="schools"]',
      'years_serving': '[data-stat="years"]',
      'resources_count': '[data-stat="resources"]',
    };
    Object.entries(map).forEach(([key, selector]) => {
      const el = document.querySelector(selector + ' [data-counter]');
      if (el && data[key]) {
        el.dataset.counter = data[key];
      }
    });
    if (data.chairman_message) {
      const msgEl = document.querySelector('[data-chairman-message]');
      if (msgEl) msgEl.textContent = data.chairman_message;
    }
    if (data.chairman_name) {
      const nameEl = document.querySelector('[data-chairman-name]');
      if (nameEl) nameEl.textContent = data.chairman_name;
    }
    initCounters();
  } catch (e) {
    initCounters();
  }
}

async function loadFeaturedNews() {
  const container = document.getElementById('featured-news');
  if (!container) return;

  try {
    const { data } = await api.news.getFeatured();
    if (!data.length) { container.innerHTML = renderEmptyState('No featured articles at this time.'); return; }
    container.innerHTML = data.map(renderNewsCard).join('');
    initScrollAnimations();
  } catch {
    container.innerHTML = renderEmptyState('Failed to load news. Please try again later.');
  }
}

async function loadUpcomingEvents() {
  const container = document.getElementById('upcoming-events');
  if (!container) return;

  try {
    const { data } = await api.events.getUpcoming();
    if (!data.length) { container.innerHTML = '<p class="text-muted text-center" style="padding:2rem">No upcoming events scheduled.</p>'; return; }
    container.innerHTML = data.map(renderEventCard).join('');
  } catch {
    container.innerHTML = '<p class="text-muted text-center" style="padding:2rem">Failed to load events.</p>';
  }
}

// ============================================
// NEWS PAGE
// ============================================
async function initNewsPage() {
  if (!document.querySelector('.news-page')) return;

  let currentPage = 1;
  const perPage = 9;
  let currentCategory = '';
  let currentSearch = '';

  const container = document.getElementById('news-container');
  const searchInput = document.getElementById('news-search');
  const searchBtn = document.getElementById('news-search-btn');

  async function loadNews() {
    if (!container) return;
    container.innerHTML = renderLoading();
    try {
      const { data, total } = await api.news.getAll({
        category: currentCategory,
        search: currentSearch,
        limit: perPage,
        offset: (currentPage - 1) * perPage,
      });
      if (!data.length) { container.innerHTML = renderEmptyState('No articles found.'); return; }
      container.innerHTML = `<div class="news-grid">${data.map(renderNewsCard).join('')}</div>`;
      renderPagination('news-pagination', total, perPage, currentPage, (p) => {
        currentPage = p;
        loadNews();
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      initScrollAnimations();
    } catch {
      container.innerHTML = renderEmptyState('Failed to load articles.');
    }
  }

  // Filter tabs
  document.querySelectorAll('.filter-tab[data-category]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      currentPage = 1;
      loadNews();
    });
  });

  // Search
  if (searchBtn) searchBtn.addEventListener('click', () => { currentSearch = searchInput?.value.trim() || ''; currentPage = 1; loadNews(); });
  if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBtn?.click(); });

  loadNews();
}

// ============================================
// RESOURCES PAGE
// ============================================
async function initResourcesPage() {
  if (!document.querySelector('.resources-page')) return;

  let currentCategory = '';
  let currentSearch = '';
  const container = document.getElementById('resources-container');
  const searchInput = document.getElementById('resources-search');
  const searchBtn = document.getElementById('resources-search-btn');

  async function loadResources() {
    if (!container) return;
    container.innerHTML = renderLoading();
    try {
      const { data } = await api.resources.getAll({ category: currentCategory, search: currentSearch, limit: 30 });
      if (!data.length) { container.innerHTML = renderEmptyState('No resources found.'); return; }
      container.innerHTML = `<div class="resources-list-grid">${data.map(renderResourceListItem).join('')}</div>`;
      attachDownloadHandlers();
    } catch {
      container.innerHTML = renderEmptyState('Failed to load resources.');
    }
  }

  document.querySelectorAll('.filter-tab[data-category]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.dataset.category;
      loadResources();
    });
  });

  if (searchBtn) searchBtn.addEventListener('click', () => { currentSearch = searchInput?.value.trim() || ''; loadResources(); });
  if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchBtn?.click(); });

  function attachDownloadHandlers() {
    document.querySelectorAll('[data-download-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.downloadId;
        try {
          const { data } = await api.resources.download(id);
          if (data.file_url) window.open(data.file_url, '_blank');
          else if (data.external_url) window.open(data.external_url, '_blank');
          else alert('Download link not available. Please contact the office.');
        } catch {
          alert('Failed to process download. Please try again.');
        }
      });
    });
  }

  loadResources();
}

// ============================================
// LEADERSHIP PAGE
// ============================================
async function initLeadershipPage() {
  if (!document.querySelector('.about-page')) return;

  const containers = {
    executive: document.getElementById('executive-leaders'),
    committee: document.getElementById('committee-leaders'),
    trustee: document.getElementById('trustee-leaders'),
  };

  const { data } = await api.leadership.getAll().catch(() => ({ data: [] }));
  const groups = { executive: [], committee: [], trustee: [] };
  data.forEach(l => { if (groups[l.position_category]) groups[l.position_category].push(l); });

  Object.entries(containers).forEach(([key, container]) => {
    if (!container) return;
    const leaders = groups[key];
    if (!leaders.length) { container.innerHTML = '<p class="text-muted">No leaders listed.</p>'; return; }
    container.innerHTML = `<div class="leaders-grid">${leaders.map(renderLeaderCard).join('')}</div>`;
  });

  initScrollAnimations();
}

// ============================================
// SCHOLARSHIPS PAGE
// ============================================
async function initScholarshipsPage() {
  if (!document.querySelector('.scholarships-page')) return;

  const container = document.getElementById('scholarships-container');
  if (!container) return;
  container.innerHTML = renderLoading();

  try {
    const { data } = await api.scholarships.getAll();
    if (!data.length) { container.innerHTML = renderEmptyState('No scholarships currently available.'); return; }
    container.innerHTML = `<div class="scholarship-cards">${data.map(renderScholarshipCard).join('')}</div>`;
    initScrollAnimations();
  } catch {
    container.innerHTML = renderEmptyState('Failed to load scholarships.');
  }
}

// ============================================
// CONTACT PAGE
// ============================================
function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('[type="submit"]');
    const feedback = document.getElementById('form-feedback');
    const originalText = submitBtn.textContent;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    if (feedback) feedback.className = 'hidden';

    const data = {
      name: form.querySelector('[name="name"]')?.value.trim(),
      email: form.querySelector('[name="email"]')?.value.trim(),
      phone: form.querySelector('[name="phone"]')?.value.trim(),
      subject: form.querySelector('[name="subject"]')?.value.trim(),
      message: form.querySelector('[name="message"]')?.value.trim(),
      category: form.querySelector('[name="category"]')?.value,
    };

    try {
      const res = await api.contact.submit(data);
      if (feedback) {
        feedback.className = 'alert alert-success';
        feedback.textContent = res.message;
        feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      form.reset();
    } catch (err) {
      if (feedback) {
        feedback.className = 'alert alert-danger';
        feedback.textContent = err.message || 'Failed to send message. Please call our office directly.';
        feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

// ============================================
// ADVOCACY PAGE
// ============================================
async function initAdvocacyPage() {
  if (!document.querySelector('.advocacy-page')) return;

  const container = document.getElementById('advocacy-container');
  if (!container) return;
  container.innerHTML = renderLoading();

  try {
    const { data } = await api.advocacy.getAll();
    if (!data.length) { container.innerHTML = renderEmptyState('No advocacy content available.'); return; }
    container.innerHTML = `<div class="advocacy-cards">${data.map(renderAdvocacyCard).join('')}</div>`;
    initScrollAnimations();
  } catch {
    container.innerHTML = renderEmptyState('Failed to load content.');
  }
}

// ============================================
// ARTICLE DETAIL PAGE (news)
// ============================================
async function initArticlePage() {
  if (!document.querySelector('.article-page')) return;

  const container = document.getElementById('article-container');
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    container.innerHTML = renderEmptyState('No article specified. <a href="/pages/news.html">Back to Notice Board</a>.');
    return;
  }

  container.innerHTML = renderLoading();

  try {
    const { data } = await api.news.getOne(slug);
    const cat = data.category || 'news';
    const date = new Date(data.published_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

    document.title = `${data.title} | KUPPET Migori`;
    setText('page-header-title', data.title);
    setText('breadcrumb-title', data.title);

    const tags = (data.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    container.innerHTML = `
      <article class="article-full">
        ${data.featured_image
          ? `<img class="article-hero" src="${escHtml(data.featured_image)}" alt="${escHtml(data.title)}">`
          : `<div class="article-hero-placeholder"><i class="fas fa-newspaper"></i></div>`}
        <div class="article-body-wrap">
          <span class="badge badge-${cat}">${cat.replace('_', ' ')}</span>
          <h1 class="article-title">${escHtml(data.title)}</h1>
          <div class="article-meta-row">
            <span class="meta-item"><i class="fas fa-user"></i> ${escHtml(data.author || 'KUPPET Migori')}</span>
            <span class="meta-item"><i class="far fa-calendar-alt"></i> ${date}</span>
            <span class="meta-item"><i class="far fa-eye"></i> ${data.views || 0} views</span>
          </div>
          <div class="article-content">${data.content || ''}</div>
          ${tags.length ? `<div class="article-tags">${tags.map(t => `<span class="article-tag">#${escHtml(t)}</span>`).join('')}</div>` : ''}
          <a href="/pages/news.html" class="btn btn-outline btn-sm article-back"><i class="fas fa-arrow-left"></i> Back to Notice Board</a>
        </div>
      </article>`;
    initScrollAnimations();
  } catch (err) {
    container.innerHTML = renderEmptyState(
      (err && err.status === 404)
        ? 'This article could not be found. It may have been removed. <a href="/pages/news.html">Back to Notice Board</a>.'
        : 'Failed to load this article. Please try again later.'
    );
  }

  // Recent articles in the sidebar
  const recent = document.getElementById('recent-articles');
  if (recent) {
    try {
      const { data } = await api.news.getAll({ limit: 5, offset: 0 });
      const others = data.filter(a => a.slug !== slug).slice(0, 4);
      recent.innerHTML = others.length
        ? others.map(a => {
            const d = new Date(a.published_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
            return `
              <div class="sidebar-recent-item">
                <div class="sidebar-recent-img">
                  ${a.featured_image ? `<img src="${escHtml(a.featured_image)}" alt="${escHtml(a.title)}" loading="lazy">` : '<i class="fas fa-newspaper"></i>'}
                </div>
                <div class="sidebar-recent-info">
                  <div class="date">${d}</div>
                  <a href="/pages/article.html?slug=${encodeURIComponent(a.slug)}">${escHtml(a.title)}</a>
                </div>
              </div>`;
          }).join('')
        : '<p style="color:var(--text-muted);font-size:0.85rem">No other articles yet.</p>';
    } catch {
      recent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Could not load recent articles.</p>';
    }
  }
}

// ============================================
// ADVOCACY DETAIL PAGE
// ============================================
async function initAdvocacyArticlePage() {
  if (!document.querySelector('.advocacy-article-page')) return;

  const container = document.getElementById('article-container');
  if (!container) return;

  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    container.innerHTML = renderEmptyState('No item specified. <a href="/pages/advocacy.html">Back to Advocacy Desk</a>.');
    return;
  }

  container.innerHTML = renderLoading();
  const icons = { rights: 'fa-shield-alt', legal: 'fa-balance-scale', labour: 'fa-handshake', policy: 'fa-file-alt', news: 'fa-newspaper', report: 'fa-flag' };

  try {
    const { data } = await api.advocacy.getOne(slug);
    const cat = data.category || 'rights';
    const date = new Date(data.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

    document.title = `${data.title} | KUPPET Migori`;
    setText('page-header-title', data.title);
    setText('breadcrumb-title', data.title);

    container.innerHTML = `
      <article class="article-full">
        <div class="article-body-wrap">
          <div class="article-icon-badge"><i class="fas ${icons[cat] || 'fa-info-circle'}"></i></div>
          <h1 class="article-title">${escHtml(data.title)}</h1>
          <div class="article-meta-row">
            <span class="meta-item"><i class="fas fa-tag"></i> ${cat.replace('_', ' ')}</span>
            <span class="meta-item"><i class="far fa-calendar-alt"></i> ${date}</span>
          </div>
          <div class="article-content">${data.content || ''}</div>
          ${data.document_url ? `<a href="${escHtml(data.document_url)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm article-doc"><i class="fas fa-file-download"></i> Download Document</a>` : ''}
          <div><a href="/pages/advocacy.html" class="btn btn-outline btn-sm article-back"><i class="fas fa-arrow-left"></i> Back to Advocacy Desk</a></div>
        </div>
      </article>`;
    initScrollAnimations();
  } catch (err) {
    container.innerHTML = renderEmptyState(
      (err && err.status === 404)
        ? 'This item could not be found. It may have been removed. <a href="/pages/advocacy.html">Back to Advocacy Desk</a>.'
        : 'Failed to load this content. Please try again later.'
    );
  }

  // More advocacy in the sidebar
  const recent = document.getElementById('recent-advocacy');
  if (recent) {
    try {
      const { data } = await api.advocacy.getAll();
      const others = data.filter(a => a.slug !== slug).slice(0, 5);
      recent.innerHTML = others.length
        ? others.map(a => `
            <div class="sidebar-recent-item">
              <div class="sidebar-recent-icon"><i class="fas ${icons[a.category] || 'fa-info-circle'}"></i></div>
              <div class="sidebar-recent-info">
                <a href="/pages/advocacy-article.html?slug=${encodeURIComponent(a.slug)}">${escHtml(a.title)}</a>
              </div>
            </div>`).join('')
        : '<p style="color:var(--text-muted);font-size:0.85rem">No other items yet.</p>';
    } catch {
      recent.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem">Could not load more items.</p>';
    }
  }
}

// ============================================
// RENDER HELPERS
// ============================================
function renderNewsCard(article) {
  const cat = article.category || 'news';
  const date = new Date(article.published_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  return `
    <article class="news-card">
      <div class="news-card-image">
        ${article.featured_image
          ? `<img src="${article.featured_image}" alt="${escHtml(article.title)}" loading="lazy">`
          : `<i class="fas fa-newspaper"></i>`}
      </div>
      <div class="news-card-body">
        <div class="news-meta">
          <span class="badge badge-${cat}">${cat.replace('_', ' ')}</span>
          <span class="news-date"><i class="far fa-calendar-alt"></i> ${date}</span>
        </div>
        <h3>${escHtml(article.title)}</h3>
        <p>${escHtml(article.excerpt || '')}</p>
      </div>
      <div class="news-card-footer">
        <span><i class="fas fa-user"></i> ${escHtml(article.author || 'KUPPET Migori')}</span>
        <a href="/pages/article.html?slug=${encodeURIComponent(article.slug)}" class="read-more">
          Read More <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </article>`;
}

function renderEventCard(event) {
  const d = new Date(event.event_date);
  const month = d.toLocaleString('en-KE', { month: 'short' }).toUpperCase();
  const day = d.getDate();
  const year = d.getFullYear();
  const time = event.event_time ? formatTime(event.event_time) : '';
  return `
    <div class="event-card">
      <div class="event-date-badge">
        <span class="month">${month}</span>
        <span class="day">${day}</span>
        <span class="year">${year}</span>
      </div>
      <div class="event-info">
        <span class="event-type-badge">${(event.event_type || 'event').replace('_', ' ')}</span>
        <h4>${escHtml(event.title)}</h4>
        <div class="event-meta">
          ${time ? `<span class="event-meta-item"><i class="far fa-clock"></i> ${time}</span>` : ''}
          ${event.venue ? `<span class="event-meta-item"><i class="fas fa-map-marker-alt"></i> ${escHtml(event.venue)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

function renderResourceListItem(r) {
  return `
    <div class="resource-list-item">
      <div class="resource-list-icon">
        <i class="${getCategoryIcon(r.category)}"></i>
      </div>
      <div class="resource-list-info">
        <span class="resource-cat-badge">${r.category?.replace('_', ' ') || 'Resource'}</span>
        <h4>${escHtml(r.title)}</h4>
        <p>${escHtml(r.description || '')}</p>
        <div class="resource-list-meta">
          ${r.subject ? `<span><i class="fas fa-book"></i> ${escHtml(r.subject)}</span>` : ''}
          ${r.grade_level ? `<span><i class="fas fa-graduation-cap"></i> ${escHtml(r.grade_level)}</span>` : ''}
          ${r.file_type ? `<span><i class="fas fa-file"></i> ${r.file_type}</span>` : ''}
          <span><i class="fas fa-download"></i> ${r.download_count || 0} downloads</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" data-download-id="${r.id}" title="Download ${escHtml(r.title)}">
        <i class="fas fa-download"></i> Download
      </button>
    </div>`;
}

function renderLeaderCard(leader) {
  return `
    <div class="leader-card">
      <div class="leader-photo">
        ${leader.photo_url
          ? `<img src="${leader.photo_url}" alt="${escHtml(leader.name)}" loading="lazy">`
          : `<i class="fas fa-user-tie"></i>`}
      </div>
      <div class="leader-body">
        <span class="leader-position">${escHtml(leader.position)}</span>
        <h3>${escHtml(leader.name)}</h3>
        <p>${escHtml((leader.bio || '').substring(0, 140))}${(leader.bio || '').length > 140 ? '...' : ''}</p>
        <div class="leader-contacts">
          ${leader.email ? `<a href="mailto:${leader.email}" class="leader-contact-btn" title="Email"><i class="fas fa-envelope"></i></a>` : ''}
          ${leader.phone ? `<a href="tel:${leader.phone}" class="leader-contact-btn" title="Phone"><i class="fas fa-phone"></i></a>` : ''}
        </div>
      </div>
    </div>`;
}

function renderScholarshipCard(s) {
  const deadline = s.application_deadline
    ? new Date(s.application_deadline).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Open';
  const isExpired = s.application_deadline && new Date(s.application_deadline) < new Date();
  return `
    <div class="scholarship-card${isExpired ? ' expired' : ''}">
      ${s.is_featured ? '<span class="scholarship-featured-badge"><i class="fas fa-star"></i> Featured</span>' : ''}
      <p class="scholarship-provider">${escHtml(s.provider)}</p>
      <h3>${escHtml(s.title)}</h3>
      <p>${escHtml((s.description || '').substring(0, 200))}${(s.description || '').length > 200 ? '...' : ''}</p>
      <div class="scholarship-meta">
        <span class="scholarship-meta-item ${isExpired ? 'scholarship-deadline' : ''}">
          <i class="far fa-calendar-alt"></i> Deadline: ${isExpired ? '<strong>Closed</strong>' : deadline}
        </span>
        <span class="scholarship-meta-item">
          <i class="fas fa-graduation-cap"></i> ${scholarshipTypeLabel(s.scholarship_type)}
        </span>
      </div>
      <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
        ${s.application_link && !isExpired ? `<a href="${s.application_link}" target="_blank" class="btn btn-primary btn-sm"><i class="fas fa-external-link-alt"></i> Apply Now</a>` : ''}
        <button class="btn btn-outline btn-sm" onclick="this.closest('.scholarship-card').querySelector('.scholarship-details').classList.toggle('hidden')">
          View Details
        </button>
      </div>
      <div class="scholarship-details hidden" style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border)">
        ${s.eligibility ? `<p><strong>Eligibility:</strong> ${escHtml(s.eligibility)}</p>` : ''}
        ${s.benefits ? `<p style="margin-top:0.5rem"><strong>Benefits:</strong> ${escHtml(s.benefits)}</p>` : ''}
        ${s.contact_email ? `<p style="margin-top:0.5rem"><strong>Contact:</strong> <a href="mailto:${s.contact_email}">${s.contact_email}</a></p>` : ''}
      </div>
    </div>`;
}

function renderAdvocacyCard(item) {
  const icons = { rights: 'fa-shield-alt', legal: 'fa-balance-scale', labour: 'fa-handshake', policy: 'fa-file-alt', news: 'fa-newspaper', report: 'fa-flag' };
  return `
    <div class="advocacy-card">
      <div class="advocacy-card-icon">
        <i class="fas ${icons[item.category] || 'fa-info-circle'}"></i>
      </div>
      <h3>${escHtml(item.title)}</h3>
      <p>${escHtml((item.category || '').replace('_', ' '))} resource</p>
      <a href="/pages/advocacy-article.html?slug=${encodeURIComponent(item.slug)}" class="service-link">
        Read More <i class="fas fa-arrow-right"></i>
      </a>
    </div>`;
}

function renderLoading() {
  return '<div class="loading"><div class="spinner"></div><p>Loading content...</p></div>';
}

function renderEmptyState(msg) {
  return `<div class="empty-state"><i class="fas fa-inbox"></i><h3>Nothing here yet</h3><p>${msg}</p></div>`;
}

function renderPagination(containerId, total, perPage, current, onPage) {
  const container = document.getElementById(containerId);
  if (!container || total <= perPage) { if (container) container.innerHTML = ''; return; }
  const pages = Math.ceil(total / perPage);
  let html = '<div class="pagination">';
  if (current > 1) html += `<button class="page-btn" data-page="${current - 1}"><i class="fas fa-chevron-left"></i></button>`;
  for (let i = Math.max(1, current - 2); i <= Math.min(pages, current + 2); i++) {
    html += `<button class="page-btn${i === current ? ' active' : ''}" data-page="${i}">${i}</button>`;
  }
  if (current < pages) html += `<button class="page-btn" data-page="${current + 1}"><i class="fas fa-chevron-right"></i></button>`;
  html += '</div>';
  container.innerHTML = html;
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => onPage(parseInt(btn.dataset.page)));
  });
}

// ============================================
// HELPERS
// ============================================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function scholarshipTypeLabel(t) {
  return ({ kcse: 'KCSE', kjsea: 'KJSEA', dte: 'DTE' })[t] || (t || '').toUpperCase();
}

function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hr = parseInt(h);
  const ampm = hr >= 12 ? 'PM' : 'AM';
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${ampm}`;
}

function getCategoryIcon(cat) {
  const icons = {
    curriculum: 'fas fa-book-open', circular: 'fas fa-file-alt',
    moe_document: 'fas fa-university', tsc_resource: 'fas fa-chalkboard-teacher',
    professional_dev: 'fas fa-award', teaching_material: 'fas fa-pencil-alt',
    legal: 'fas fa-balance-scale', policy: 'fas fa-file-contract',
  };
  return icons[cat] || 'fas fa-file';
}

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  loadHomepageData();
  initNewsPage();
  initResourcesPage();
  initLeadershipPage();
  initScholarshipsPage();
  initContactForm();
  initAdvocacyPage();
  initArticlePage();
  initAdvocacyArticlePage();
});
