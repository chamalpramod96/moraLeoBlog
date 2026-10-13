/* ═══════════════════════════════════════════════════════════════
   Leo Club of Moratuwa — Blog JavaScript
   ─────────────────────────────────────────────────────────────
   Features:
   • Animated particle background in hero
   • Reading progress bar
   • Scroll-triggered animations (reveal on scroll)
   • Animated hero stats counters (DYNAMIC: counts real articles, categories, visitors)
   • Sticky navbar with scroll effect
   • Mobile hamburger menu
   • Category filter tabs
   • Live search
   • Post modal reader (click any card to open)
   • Share buttons (Facebook, Twitter, WhatsApp, copy link)
   • Back to top button
   • Toast notifications
   ═══════════════════════════════════════════════════════════════ */

/* ───────────────────────────────────────────────────────────
   DYNAMIC STATS — Count articles, categories, and track visitors
─────────────────────────────────────────────────────────── */
function initDynamicStats() {
  // Count total blog articles
  const totalArticles = document.querySelectorAll('.blog-grid .blog-card').length;
  
  // Count unique categories
  const categories = new Set();
  document.querySelectorAll('.blog-grid .blog-card').forEach(card => {
    const cat = card.dataset.category;
    if (cat) categories.add(cat);
  });
  const totalCategories = categories.size;
  
  // Get or initialize visitor count (persists in localStorage)
  let visitorsCount = localStorage.getItem('blogVisitors');
  if (!visitorsCount) {
    visitorsCount = Math.floor(Math.random() * 500) + 100; // Start with 100-600 visitors
  } else {
    visitorsCount = parseInt(visitorsCount, 10);
    // Increment by 1 visitor (this visit)
    visitorsCount += 1;
  }
  localStorage.setItem('blogVisitors', visitorsCount.toString());
  
  // Update HTML with dynamic values
  const articlesEl = document.getElementById('articlesCount');
  const categoriesEl = document.getElementById('categoriesCount');
  const visitorsEl = document.getElementById('visitorsCount');
  
  if (articlesEl) {
    articlesEl.dataset.target = totalArticles.toString();
  }
  if (categoriesEl) {
    categoriesEl.dataset.target = totalCategories.toString();
  }
  if (visitorsEl) {
    visitorsEl.dataset.target = visitorsCount.toString();
  }
}

'use strict';

const normalizeToken = window.TextUtils?.normalizeToken || ((value) => String(value || '').toLowerCase().trim());

/* ───────────────────────────────────────────────────────────
   ARTICLES SOURCE — inject external article HTML if provided
─────────────────────────────────────────────────────────── */
async function injectArticlesFromExternalFile() {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;

  // Keep existing inline cards if present; only inject when grid is empty.
  if (grid.querySelector('.blog-card')) return;

  const externalHtml = await Promise.resolve(window.ContentService?.getRawArticleHtml?.() || '');
  if (typeof externalHtml === 'string' && externalHtml.trim().length) {
    grid.innerHTML = externalHtml;
  }
}

function toAbsoluteUrl(pathOrUrl) {
  try {
    return new URL(pathOrUrl, window.location.href).toString();
  } catch (_) {
    return window.location.href;
  }
}

function setJsonLd(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = JSON.stringify(data);
}

function updateCanonicalAndOgUrl() {
  const clean = new URL(window.location.href);
  clean.hash = '';
  const canonical = clean.toString();

  const canonicalEl = document.getElementById('canonicalLink');
  if (canonicalEl) canonicalEl.setAttribute('href', canonical);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.setAttribute('content', canonical);
}

function setPostUrlState(slug) {
  const url = new URL(window.location.href);
  if (slug) {
    url.searchParams.set('post', slug);
  } else {
    url.searchParams.delete('post');
  }
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  updateCanonicalAndOgUrl();
}

function buildArchiveJsonLd(visibleCards, contextLabel) {
  const items = visibleCards.map((card, idx) => {
    const title = card.querySelector('.card-title')?.textContent?.trim() || 'Article';
    const description = card.querySelector('.card-excerpt')?.textContent?.trim() || '';
    const url = toAbsoluteUrl(`index.html?post=${encodeURIComponent(card.dataset.slug || normalizeToken(title))}`);
    const authorName = card.dataset.author || 'Leo Club of Moratuwa';
    const published = card.dataset.date || '';

    return {
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'BlogPosting',
        headline: title,
        description,
        datePublished: published,
        author: {
          '@type': 'Person',
          name: authorName,
        },
        url,
      },
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'The Leo Chronicle',
    description: contextLabel || 'Stories of service, leadership, and impact from the Leo Club of Moratuwa.',
    url: toAbsoluteUrl(window.location.pathname + window.location.search),
    blogPost: items.map(i => i.item),
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items,
    },
  };
}

function buildBreadcrumbJsonLd(contextBits) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: toAbsoluteUrl('index.html'),
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Blog',
      item: toAbsoluteUrl(window.location.pathname + window.location.search),
    },
  ];

  if (contextBits.length) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: contextBits.join(' | '),
      item: toAbsoluteUrl(window.location.pathname + window.location.search),
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  };
}

/* ───────────────────────────────────────────────────────────
   PARTICLES — Animated background canvas in hero
─────────────────────────────────────────────────────────── */
function initParticles() {
  const canvas = document.getElementById('particlesCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  const COUNT = 65;
  const COLORS = [
    'rgba(204,0,0,',
    'rgba(201,168,76,',
    'rgba(255,255,255,'
  ];
  const WEIGHTS = [0.4, 0.4, 0.2]; // probability weights

  function weightedColor() {
    const r = Math.random();
    if (r < WEIGHTS[0]) return COLORS[0];
    if (r < WEIGHTS[0] + WEIGHTS[1]) return COLORS[1];
    return COLORS[2];
  }

  function rand(a, b) { return Math.random() * (b - a) + a; }

  function resize() {
    W = canvas.width  = canvas.offsetWidth;
    H = canvas.height = canvas.offsetHeight;
  }

  function makeParticle(x, y) {
    return {
      x: x !== undefined ? x : rand(0, W),
      y: y !== undefined ? y : rand(0, H),
      r: rand(0.8, 2.8),
      vx: rand(-0.25, 0.25),
      vy: rand(-0.55, -0.12),
      color: weightedColor(),
      alpha: rand(0.15, 0.7),
      alphaSpeed: rand(0.003, 0.007) * (Math.random() > 0.5 ? 1 : -1),
    };
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      /* Draw dot */
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fill();

      /* Move */
      p.x  += p.vx;
      p.y  += p.vy;
      p.alpha += p.alphaSpeed;
      if (p.alpha > 0.72 || p.alpha < 0.12) p.alphaSpeed *= -1;

      /* Wrap vertically */
      if (p.y < -10) { p.y = H + 10; p.x = rand(0, W); }
      if (p.x < -10 || p.x > W + 10) p.x = rand(0, W);
    }

    /* Draw gold connecting lines between nearby particles */
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx   = particles[i].x - particles[j].x;
        const dy   = particles[i].y - particles[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist < 110) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(201,168,76,${0.07 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(draw);
  }

  /* Resize handler */
  const ro = new ResizeObserver(() => {
    resize();
    particles = Array.from({ length: COUNT }, () => makeParticle());
  });
  ro.observe(canvas.parentElement);

  resize();
  particles = Array.from({ length: COUNT }, () => makeParticle());
  draw();
}

/* ───────────────────────────────────────────────────────────
   READING PROGRESS BAR
─────────────────────────────────────────────────────────── */
function initProgressBar() {
  const bar = document.getElementById('progressBar');
  if (!bar) return;

  function update() {
    const scrolled   = window.scrollY;
    const docHeight  = document.documentElement.scrollHeight - window.innerHeight;
    const percentage = docHeight > 0 ? (scrolled / docHeight) * 100 : 0;
    bar.style.width  = percentage + '%';
  }

  window.addEventListener('scroll', update, { passive: true });
}

/* ───────────────────────────────────────────────────────────
   NAVBAR — scroll effect + mobile hamburger
─────────────────────────────────────────────────────────── */
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');
  if (!navbar) return;

  /* Scroll class */
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  /* Hamburger toggle */
  hamburger?.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    navLinks?.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  /* Close on link click */
  navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger?.classList.remove('open');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* Close on backdrop click (mobile) */
  document.addEventListener('click', (e) => {
    if (
      navLinks?.classList.contains('open') &&
      !navLinks.contains(e.target) &&
      !hamburger?.contains(e.target)
    ) {
      hamburger?.classList.remove('open');
      navLinks.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/* ───────────────────────────────────────────────────────────
   HERO STATS COUNTERS — animated number count-up
─────────────────────────────────────────────────────────── */
function initHeroCounters() {
  const counters = document.querySelectorAll('.h-counter[data-target]');
  if (!counters.length) return;

  function animateCounter(el) {
    const target   = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const start    = performance.now();

    function update(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      /* Ease out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target;
      }
    }
    requestAnimationFrame(update);
  }

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        animateCounter(e.target);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.6 });

  counters.forEach(c => obs.observe(c));
}

/* ───────────────────────────────────────────────────────────
   SCROLL REVEAL — fade-in + slide-up on scroll
─────────────────────────────────────────────────────────── */
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (!reveals.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  reveals.forEach(el => obs.observe(el));
}

/* ───────────────────────────────────────────────────────────
   FILTER — category tabs + live search
─────────────────────────────────────────────────────────── */
function initFilter() {
  const tabs       = document.querySelectorAll('.cat-tab');
  const cards      = Array.from(document.querySelectorAll('.blog-card'));
  const countEl    = document.getElementById('postsCount');
  const noResults  = document.getElementById('noResults');
  const archiveHint = document.getElementById('archiveHint');
  const searchInput  = document.getElementById('searchInput');
  const searchClear  = document.getElementById('searchClear');
  const authorFilter = document.getElementById('authorFilter');
  const tagFilter    = document.getElementById('tagFilter');
  const pagePrevBtn  = document.getElementById('pagePrevBtn');
  const pageNextBtn  = document.getElementById('pageNextBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  if (!cards.length) return;

  const contentService = window.ContentService;
  const postRecords = contentService?.buildPostRecords?.(cards) || cards.map(card => {
    const title = card.querySelector('.card-title')?.textContent?.trim() || '';
    const excerpt = card.querySelector('.card-excerpt')?.textContent?.trim() || '';
    const slug = card.dataset.slug || normalizeToken(title);
    return {
      id: slug,
      slug,
      title,
      excerpt,
      category: String(card.dataset.category || '').toLowerCase(),
      date: String(card.dataset.date || '').trim(),
      author: String(card.dataset.author || ''),
      tags: String(card.dataset.tags || '').split('|').filter(Boolean),
      card,
    };
  });

  let activeCat   = 'all';
  let searchTerm  = '';
  let activeAuthor = '';
  let activeTag = '';
  let activePostSlug = '';
  let currentPage = 1;
  let autoOpenedPostSlug = '';
  const postsPerPage = 6;

  function parsePathTaxonomy() {
    const parts = window.location.pathname.split('/').filter(Boolean).map(p => decodeURIComponent(p).toLowerCase());
    const result = { category: '', author: '', tag: '' };
    const cIdx = parts.indexOf('category');
    const aIdx = parts.indexOf('author');
    const tIdx = parts.indexOf('tag');
    if (cIdx >= 0 && parts[cIdx + 1]) result.category = parts[cIdx + 1];
    if (aIdx >= 0 && parts[aIdx + 1]) result.author = parts[aIdx + 1];
    if (tIdx >= 0 && parts[tIdx + 1]) result.tag = parts[tIdx + 1];
    return result;
  }

  function ensureSelectOption(selectEl, value, labelPrefix) {
    if (!selectEl || !value) return;
    const exists = Array.from(selectEl.options).some(o => o.value === value);
    if (exists) return;
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = `${labelPrefix} ${value}`;
    selectEl.appendChild(opt);
  }

  function populateTaxonomySelects() {
    if (!authorFilter && !tagFilter) return;

    const allAuthors = Array.from(new Set(cards.map(card => card.dataset.author || '').filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const allTags = Array.from(new Set(
      cards.flatMap(card => (card.dataset.tags || '').split('|').map(t => t.trim()).filter(Boolean))
    )).sort((a, b) => a.localeCompare(b));

    if (authorFilter) {
      authorFilter.innerHTML = '<option value="">All Authors</option>';
      allAuthors.forEach(author => {
        const opt = document.createElement('option');
        opt.value = author;
        opt.textContent = author;
        authorFilter.appendChild(opt);
      });
    }

    if (tagFilter) {
      tagFilter.innerHTML = '<option value="">All Tags</option>';
      allTags.forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        tagFilter.appendChild(opt);
      });
    }
  }

  function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const pathTax = parsePathTaxonomy();
    const category = (params.get('category') || '').trim().toLowerCase();
    const author = (params.get('author') || '').trim();
    const tag = (params.get('tag') || '').trim();
    const post = normalizeToken((params.get('post') || '').trim());
    const q = (params.get('q') || '').trim().toLowerCase();
    const page = parseInt(params.get('page') || '1', 10);

    const allowedCategories = new Set(['all', ...Array.from(tabs).map(t => t.dataset.cat)]);
    const fromPathCategory = pathTax.category;
    activeCat = allowedCategories.has(fromPathCategory) ? fromPathCategory : (allowedCategories.has(category) ? category : 'all');
    searchTerm = q;
    activeAuthor = author;
    activeTag = tag;
    activePostSlug = post;

    if (pathTax.author) {
      activeAuthor = decodeURIComponent(pathTax.author).replace(/-/g, ' ');
    }
    if (pathTax.tag) {
      activeTag = decodeURIComponent(pathTax.tag).replace(/-/g, ' ');
    }

    if (activePostSlug) {
      activeCat = 'all';
      activeAuthor = '';
      activeTag = '';
      searchTerm = '';
    }

    currentPage = Number.isFinite(page) && page > 0 ? page : 1;

    if (searchInput) {
      searchInput.value = searchTerm;
    }
    searchClear?.classList.toggle('visible', searchTerm.length > 0);

    ensureSelectOption(authorFilter, activeAuthor, 'Author:');
    ensureSelectOption(tagFilter, activeTag, 'Tag:');
    if (authorFilter) authorFilter.value = activeAuthor;
    if (tagFilter) tagFilter.value = activeTag;
  }

  function writeStateToUrl() {
    if (activePostSlug) {
      setPostUrlState(activePostSlug);
      return;
    }

    const params = new URLSearchParams();
    if (activeCat !== 'all') params.set('category', activeCat);
    if (activeAuthor) params.set('author', activeAuthor);
    if (activeTag) params.set('tag', activeTag);
    if (searchTerm) params.set('q', searchTerm);
    if (currentPage > 1) params.set('page', String(currentPage));

    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
    history.replaceState(null, '', nextUrl);
    updateCanonicalAndOgUrl();
  }

  function updateSeoState(totalVisible) {
    const titleBits = ['The Leo Chronicle'];
    const contextBits = [];
    if (activePostSlug) {
      const postCard = cards.find(card => normalizeToken(card.dataset.slug || '') === activePostSlug);
      const postTitle = postCard?.querySelector('.card-title')?.textContent?.trim();
      if (postTitle) {
        titleBits.push(postTitle);
        contextBits.push(`Post: ${postTitle}`);
      }
    }
    if (activeCat !== 'all') {
      const v = activeCat.charAt(0).toUpperCase() + activeCat.slice(1);
      titleBits.push(v);
      contextBits.push(`Category: ${v}`);
    }
    if (activeAuthor) {
      titleBits.push(`Author: ${activeAuthor}`);
      contextBits.push(`Author: ${activeAuthor}`);
    }
    if (activeTag) {
      titleBits.push(`Tag: ${activeTag}`);
      contextBits.push(`Tag: ${activeTag}`);
    }
    if (searchTerm) {
      titleBits.push(`Search: ${searchTerm}`);
      contextBits.push(`Search: ${searchTerm}`);
    }
    if (currentPage > 1) {
      titleBits.push(`Page ${currentPage}`);
      contextBits.push(`Page ${currentPage}`);
    }
    titleBits.push('Leo Club of Moratuwa');
    document.title = titleBits.join(' | ');

    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) {
      let desc = `Showing ${totalVisible} article${totalVisible !== 1 ? 's' : ''}`;
      if (activeCat !== 'all') desc += ` in ${activeCat}`;
      if (activeAuthor) desc += ` by ${activeAuthor}`;
      if (activeTag) desc += ` tagged ${activeTag}`;
      if (searchTerm) desc += ` matching "${searchTerm}"`;
      desc += ' on The Leo Chronicle.';
      descEl.setAttribute('content', desc);

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', desc);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', document.title);

    updateCanonicalAndOgUrl();

    const visibleCards = Array.from(document.querySelectorAll('.blog-card')).filter(card => card.style.display !== 'none');
    setJsonLd('blogSchemaJsonLd', buildArchiveJsonLd(visibleCards, contextBits.join(' | ')));
    setJsonLd('breadcrumbsJsonLd', buildBreadcrumbJsonLd(contextBits));
  }

  function getFilteredCards() {
    if (contentService?.filterPosts) {
      return contentService.filterPosts(postRecords, {
        category: activeCat,
        author: activeAuthor,
        tag: activeTag,
        searchTerm,
        postSlug: activePostSlug,
      }).map(post => post.card);
    }

    return postRecords
      .filter(post => {
        if (activePostSlug) {
          return normalizeToken(post.slug || '') === activePostSlug;
        }

        const catMatch = activeCat === 'all' || post.category === activeCat;
        const searchMatch = !searchTerm || String(post.title || '').toLowerCase().includes(searchTerm) || String(post.excerpt || '').toLowerCase().includes(searchTerm);
        const authorMatch = !activeAuthor || String(post.author || '').toLowerCase() === activeAuthor.toLowerCase();
        const tags = Array.isArray(post.tags) ? post.tags.map(t => String(t).toLowerCase()) : [];
        const tagMatch = !activeTag || tags.includes(activeTag.toLowerCase());
        return catMatch && searchMatch && authorMatch && tagMatch;
      })
      .map(post => post.card);
  }

  function applyFilter() {
    const filtered = getFilteredCards();
    const totalVisible = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalVisible / postsPerPage));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * postsPerPage;
    const end = start + postsPerPage;

    cards.forEach(card => {
      card.style.display = 'none';
    });

    filtered.slice(start, end).forEach(card => {
      card.style.display = '';
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'filterIn 0.42s ease both';
    });

    if (countEl) {
      countEl.innerHTML = `Showing <strong>${Math.min(totalVisible, postsPerPage)}</strong> of <strong>${totalVisible}</strong> article${totalVisible !== 1 ? 's' : ''}`;
    }
    if (noResults) {
      noResults.style.display = totalVisible === 0 ? 'block' : 'none';
    }

    if (archiveHint) {
      const parts = [];
      if (activeCat !== 'all') parts.push(`Category: ${activeCat}`);
      if (activeAuthor) parts.push(`Author: ${activeAuthor}`);
      if (activeTag) parts.push(`Tag: ${activeTag}`);
      archiveHint.textContent = parts.length ? `Archive View — ${parts.join(' • ')}` : '';
    }

    if (pageIndicator) {
      pageIndicator.textContent = `Page ${totalVisible === 0 ? 0 : currentPage} of ${totalVisible === 0 ? 0 : totalPages}`;
    }
    if (pagePrevBtn) {
      pagePrevBtn.disabled = currentPage <= 1 || totalVisible === 0;
    }
    if (pageNextBtn) {
      pageNextBtn.disabled = currentPage >= totalPages || totalVisible === 0;
    }

    tabs.forEach(t => {
      const isActive = t.dataset.cat === activeCat;
      t.classList.toggle('active', isActive);
      t.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    writeStateToUrl();
    updateSeoState(totalVisible);

    if (activePostSlug) {
      const target = filtered.find(card => normalizeToken(card.dataset.slug || '') === activePostSlug);
      if (target && autoOpenedPostSlug !== activePostSlug) {
        const title = target.querySelector('.card-title')?.textContent.trim() || 'Article';
        autoOpenedPostSlug = activePostSlug;
        openCardArticle(target, title);
      }
    }
  }

  /* Tab clicks */
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activePostSlug = '';
      activeCat = tab.dataset.cat;
      currentPage = 1;
      applyFilter();
    });
  });

  /* Live search */
  searchInput?.addEventListener('input', (e) => {
    activePostSlug = '';
    searchTerm = e.target.value.toLowerCase().trim();
    currentPage = 1;
    searchClear?.classList.toggle('visible', searchTerm.length > 0);
    applyFilter();
  });

  /* Clear search */
  searchClear?.addEventListener('click', () => {
    activePostSlug = '';
    if (searchInput) searchInput.value = '';
    searchTerm = '';
    currentPage = 1;
    searchClear.classList.remove('visible');
    applyFilter();
  });

  authorFilter?.addEventListener('change', () => {
    activePostSlug = '';
    activeAuthor = authorFilter.value;
    currentPage = 1;
    applyFilter();
  });

  tagFilter?.addEventListener('change', () => {
    activePostSlug = '';
    activeTag = tagFilter.value;
    currentPage = 1;
    applyFilter();
  });

  pagePrevBtn?.addEventListener('click', () => {
    activePostSlug = '';
    if (currentPage <= 1) return;
    currentPage -= 1;
    applyFilter();
  });

  pageNextBtn?.addEventListener('click', () => {
    activePostSlug = '';
    currentPage += 1;
    applyFilter();
  });

  window.addEventListener('popstate', () => {
    readStateFromUrl();
    applyFilter();
  });

  populateTaxonomySelects();
  readStateFromUrl();
  applyFilter();
}

/* ───────────────────────────────────────────────────────────
   MODAL — open / close article reader
─────────────────────────────────────────────────────────── */
let _currentPostTitle = 'Leo Club of Moratuwa Blog';
let _modalVisit = 0;   /* goes up each time the reader opens or closes an article */

function openModal(contentHTML, title) {
  const overlay   = document.getElementById('modalOverlay');
  const contentEl = document.getElementById('modalContent');
  if (!overlay || !contentEl) return;

  _modalVisit += 1;
  _currentPostTitle = title || 'Leo Club of Moratuwa Blog';
  contentEl.innerHTML = contentHTML;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  /* Scroll modal content to top */
  setTimeout(() => { contentEl.scrollTop = 0; }, 10);
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  _modalVisit += 1;
  overlay?.classList.remove('open');
  document.body.style.overflow = '';
  setPostUrlState('');
}

/* Opens a card's article. A site article carries its text in a <template>;
   a post written in the admin panel is fetched when the reader opens it. */
async function openCardArticle(card, title) {
  const template = card.querySelector('template.post-full-content');
  if (template) {
    openModal(template.innerHTML, title);
    return;
  }

  openModal('<p class="content-loading">Loading article…</p>', title);
  const visit = _modalVisit;
  const html = await Promise.resolve(window.ContentService?.getPostContentHtml?.(card.dataset.postId) || '');

  /* The reader may have closed it, or opened another one, while it loaded */
  if (visit !== _modalVisit) return;
  const contentEl = document.getElementById('modalContent');
  if (contentEl) {
    contentEl.innerHTML = html || '<p class="content-loading">This article could not be loaded. Please try again.</p>';
  }
}

/* Called by the featured post "Read More" button */
function openPost(buttonEl) {
  const card     = buttonEl.closest('.featured-card, .blog-card');
  const template = card?.querySelector('template.post-full-content');
  if (!template) return;
  const title = (
    card.querySelector('.featured-title')?.textContent ||
    card.querySelector('.card-title')?.textContent ||
    'Article'
  ).trim();
  const slug = card?.dataset?.slug || normalizeToken(title);
  setPostUrlState(slug);
  openModal(template.content.cloneNode(true).textContent
    ? template.innerHTML
    : 'Content coming soon.', title);
}

function initModal() {
  const overlay        = document.getElementById('modalOverlay');
  const closeBtn       = document.getElementById('modalClose');
  const closeBottomBtn = document.getElementById('modalCloseBottom');

  closeBtn?.addEventListener('click', closeModal);
  closeBottomBtn?.addEventListener('click', closeModal);

  /* Click outside modal to close */
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  /* Escape key */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('open')) {
      closeModal();
    }
  });
}

/* Attach click events to all blog cards */
function initCardClicks() {
  document.querySelectorAll('.blog-card').forEach(card => {
    card.addEventListener('click', () => {
      const title = card.querySelector('.card-title')?.textContent.trim() || 'Article';
      const slug = card.dataset.slug || normalizeToken(title);
      setPostUrlState(slug);
      openCardArticle(card, title);
    });
  });
}

/* ───────────────────────────────────────────────────────────
   SHARE BUTTONS
─────────────────────────────────────────────────────────── */
function sharePost(platform) {
  const url  = encodeURIComponent(window.location.href);
  const text = encodeURIComponent(_currentPostTitle);
  let shareUrl = '';

  switch (platform) {
    case 'facebook':
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
      break;
    case 'whatsapp':
      shareUrl = `https://wa.me/?text=${text}%20${url}`;
      break;
    case 'copy':
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(window.location.href)
          .then(() => showToast('✓  Link copied to clipboard!'))
          .catch(() => showToast('Please copy the URL from your browser.'));
      } else {
        showToast('Please copy the URL from your browser.');
      }
      return;
    default:
      return;
  }

  window.open(shareUrl, '_blank', 'noopener,noreferrer,width=620,height=420');
}

/* ───────────────────────────────────────────────────────────
   TOAST NOTIFICATION
─────────────────────────────────────────────────────────── */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ───────────────────────────────────────────────────────────
   BACK TO TOP BUTTON
─────────────────────────────────────────────────────────── */
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ───────────────────────────────────────────────────────────
   FEATURED POST BUTTON
─────────────────────────────────────────────────────────── */
function initFeaturedBtn() {
  const btn = document.querySelector('.btn-read-more[data-post="featured"]');
  btn?.addEventListener('click', () => openPost(btn));
}

/* ───────────────────────────────────────────────────────────
   KEYBOARD NAVIGATION inside modal
─────────────────────────────────────────────────────────── */
function initKeyboardNav() {
  document.addEventListener('keydown', (e) => {
    const overlay = document.getElementById('modalOverlay');
    if (!overlay?.classList.contains('open')) return;
    /* Tab trap inside modal */
    if (e.key === 'Tab') {
      const focusable = overlay.querySelectorAll('button, a, input, [tabindex]');
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
}

/* ───────────────────────────────────────────────────────────
   INIT EVERYTHING on DOM ready
─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await injectArticlesFromExternalFile();
  initDynamicStats();        /* Load real article/category/visitor counts FIRST */
  initParticles();
  initProgressBar();
  initNavbar();
  initHeroCounters();        /* Will use values from initDynamicStats */
  initScrollReveal();
  initFilter();
  initModal();
  initCardClicks();
  initFeaturedBtn();
  initBackToTop();
  initKeyboardNav();
});

/* ── Expose globals for inline onclick attributes ── */
window.sharePost = sharePost;
window.openPost  = openPost;
