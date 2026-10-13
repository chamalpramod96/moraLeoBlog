(function (global) {
  'use strict';

  // Where the blog's articles come from:
  //   • Site articles — written by hand in js/articles/*.js, part of the site.
  //   • Admin posts   — written in /admin, kept in the Mora Connect database.
  // A visit reads ONE small document (the published list: title, excerpt, date…
  // of every admin post) and shows those posts above the site articles. The
  // text of an admin post is fetched only when a reader opens it. If the list
  // can't be read, the blog simply shows the site articles.

  var normalizeToken = global.TextUtils && typeof global.TextUtils.normalizeToken === 'function'
    ? global.TextUtils.normalizeToken
    : function (value) { return String(value || '').toLowerCase().trim(); };

  var escapeHtml = global.SafeHtml.escapeHtml;

  var ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

  function formatDisplayDate(isoDay) {
    var m = ISO_DAY.exec(String(isoDay || ''));
    if (!m) return '';
    // A calendar day, not a moment: show it the same in every time zone
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: '2-digit', timeZone: 'UTC'
    });
  }

  function parseFirestoreValue(value) {
    if (!value || typeof value !== 'object') return null;

    if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return parseInt(value.integerValue, 10);
    if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return !!value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, 'timestampValue')) return value.timestampValue;
    if (Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;

    if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) {
      var arr = value.arrayValue && Array.isArray(value.arrayValue.values)
        ? value.arrayValue.values
        : [];
      return arr.map(parseFirestoreValue);
    }

    if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) {
      var fields = value.mapValue && value.mapValue.fields ? value.mapValue.fields : {};
      return decodeFirestoreFields(fields);
    }

    return null;
  }

  function decodeFirestoreFields(fields) {
    var out = {};
    Object.keys(fields || {}).forEach(function (key) {
      out[key] = parseFirestoreValue(fields[key]);
    });
    return out;
  }

  function mapCategoryIcon(category) {
    var c = String(category || '').toLowerCase();
    var icons = {
      news: 'fa-bullhorn',
      events: 'fa-calendar-check',
      service: 'fa-hands-helping',
      leadership: 'fa-chess-king',
      education: 'fa-book-open',
      environment: 'fa-leaf',
      health: 'fa-heartbeat',
      technology: 'fa-microchip',
      stories: 'fa-heart',
      achievements: 'fa-award'
    };
    return icons[c] || 'fa-newspaper';
  }

  function avatarClassForCategory(category) {
    var c = String(category || '').toLowerCase();
    if (c === 'environment') return 'green';
    if (c === 'service' || c === 'education' || c === 'stories' || c === 'achievements') return 'gold';
    return 'red';
  }

  function getStaticFallbackHtml() {
    var articleParts = global.BLOG_ARTICLES_PARTS;
    if (Array.isArray(articleParts) && articleParts.length) {
      return articleParts.join('\n\n');
    }

    var fallback = global.BLOG_ARTICLES_HTML;
    return typeof fallback === 'string' ? fallback : '';
  }

  // ── Reading the database (public documents only, no sign-in) ────────────────

  /** One document's fields, or null if it is missing, private or unreachable. */
  async function fetchDocument(path) {
    var config = global.FIREBASE_CONTENT_CONFIG || {};
    if (!config.projectId || !config.firestoreUrl || !path) return null;

    var url = config.firestoreUrl + '/projects/' + encodeURIComponent(config.projectId) +
      '/databases/(default)/documents/' + path.split('/').map(encodeURIComponent).join('/');

    try {
      var res = await fetch(url, { method: 'GET' });
      if (!res.ok) return null;
      var data = await res.json();
      return data && data.fields ? decodeFirestoreFields(data.fields) : null;
    } catch (_) {
      return null;
    }
  }

  function toIndexPost(raw) {
    var entry = raw && typeof raw === 'object' ? raw : {};
    var id = String(entry.id || '');
    var title = String(entry.title || '').trim();
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !title) return null;

    return {
      id: id,
      slug: normalizeToken(entry.slug || title),
      title: title,
      category: normalizeToken(entry.category) || 'news',
      author: String(entry.author || '').trim(),
      date: ISO_DAY.test(String(entry.date || '')) ? String(entry.date) : '',
      readTime: String(entry.readTime || '').trim(),
      excerpt: String(entry.excerpt || '').trim(),
      coverImage: String(entry.coverImage || ''),
      tags: Array.isArray(entry.tags) ? entry.tags.filter(Boolean).map(String) : [],
      featured: !!entry.featured
    };
  }

  var publishedPostsPromise = null;

  /** The published admin posts, newest first. Empty if there are none (or no connection). */
  function getPublishedPosts() {
    if (!publishedPostsPromise) {
      var config = global.FIREBASE_CONTENT_CONFIG || {};
      publishedPostsPromise = fetchDocument(config.indexDoc).then(function (doc) {
        var list = doc && Array.isArray(doc.posts) ? doc.posts : [];
        return list.map(toIndexPost).filter(Boolean).sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
      });
    }
    return publishedPostsPromise;
  }

  async function getRawArticleHtml() {
    var staticHtml = getStaticFallbackHtml();
    var posts = await getPublishedPosts();
    if (!posts.length) return staticHtml;

    // A site article that was imported into the database is shown once, from
    // the database. A <template> keeps the site HTML inert while it is checked.
    var taken = {};
    posts.forEach(function (post) { taken[post.slug] = true; });

    var holder = document.createElement('template');
    holder.innerHTML = staticHtml;
    Array.prototype.forEach.call(holder.content.querySelectorAll('.blog-card'), function (card) {
      var titleEl = card.querySelector('.card-title');
      if (taken[normalizeToken(titleEl ? titleEl.textContent : '')]) card.remove();
    });

    return posts.map(renderPostCardHtml).join('\n\n') + '\n\n' + holder.innerHTML;
  }

  /** The full article of an admin post, ready for the reader — '' if it can't be shown. */
  async function getPostContentHtml(postId) {
    var config = global.FIREBASE_CONTENT_CONFIG || {};
    var id = String(postId || '');
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) return '';

    var post = await fetchDocument((config.postsCollection || 'blogPosts') + '/' + id);
    if (!post || post.status !== 'published') return '';

    var title = escapeHtml(post.title || 'Untitled');
    var dateDisplay = escapeHtml(formatDisplayDate(post.date));
    var readTime = escapeHtml(post.readTime || '');
    var author = escapeHtml(post.author || 'Leo Editorial Team');
    var body = await global.SafeHtml.clean(post.contentHtml || '');

    var meta = [];
    if (dateDisplay) meta.push('<i class="far fa-calendar-alt"></i> ' + dateDisplay);
    if (readTime) meta.push('<i class="far fa-clock"></i> ' + readTime);
    meta.push('By ' + author);

    var tags = Array.isArray(post.tags) ? post.tags.filter(Boolean) : [];
    var tagsHtml = tags.length
      ? '<div class="content-tags">' + tags.map(function (t) { return '<span class="tag">' + escapeHtml(t) + '</span>'; }).join('') + '</div>'
      : '';

    return '<h2>' + title + '</h2>' +
      '<p class="content-meta">' + meta.join(' &nbsp;|&nbsp; ') + '</p>' +
      (body || '<p>' + escapeHtml(post.excerpt || '') + '</p>') +
      tagsHtml;
  }

  function searchPosts(posts, term) {
    var list = Array.isArray(posts) ? posts : [];
    var q = String(term || '').trim().toLowerCase();
    if (!q) return list;

    return list.filter(function (post) {
      var title = String(post.title || '').toLowerCase();
      var excerpt = String(post.excerpt || '').toLowerCase();
      return title.indexOf(q) >= 0 || excerpt.indexOf(q) >= 0;
    });
  }

  function filterPosts(posts, filters) {
    var list = Array.isArray(posts) ? posts : [];
    var state = filters || {};

    var activeCat = String(state.category || 'all').toLowerCase();
    var activeAuthor = String(state.author || '').toLowerCase();
    var activeTag = String(state.tag || '').toLowerCase();
    var searchTerm = String(state.searchTerm || '').toLowerCase().trim();
    var postSlug = normalizeToken(String(state.postSlug || ''));

    return list.filter(function (post) {
      if (postSlug) {
        return normalizeToken(post.slug || '') === postSlug;
      }

      var catMatch = activeCat === 'all' || String(post.category || '').toLowerCase() === activeCat;
      var authorMatch = !activeAuthor || String(post.author || '').toLowerCase() === activeAuthor;
      var tags = Array.isArray(post.tags) ? post.tags.map(function (t) { return String(t).toLowerCase(); }) : [];
      var tagMatch = !activeTag || tags.indexOf(activeTag) >= 0;
      var title = String(post.title || '').toLowerCase();
      var excerpt = String(post.excerpt || '').toLowerCase();
      var searchMatch = !searchTerm || title.indexOf(searchTerm) >= 0 || excerpt.indexOf(searchTerm) >= 0;

      return catMatch && authorMatch && tagMatch && searchMatch;
    });
  }

  function textOf(el) {
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  }

  /**
   * One record per card on the page, read from the card itself. Admin posts
   * carry their author and tags as data- attributes; a site article has them
   * in its markup (the author line, and the tags at the end of the article).
   */
  function buildPostRecords(cards) {
    var cardList = Array.isArray(cards) ? cards : [];

    return cardList.map(function (card) {
      var title = textOf(card.querySelector('.card-title'));
      var slug = card.dataset.slug || normalizeToken(title);
      var author = card.dataset.author || textOf(card.querySelector('.post-author-sm span'));
      var tags = String(card.dataset.tags || '').split('|').filter(Boolean);

      if (!tags.length) {
        var template = card.querySelector('template.post-full-content');
        if (template) {
          tags = Array.prototype.map.call(template.content.querySelectorAll('.content-tags .tag'), textOf).filter(Boolean);
        }
      }

      card.dataset.slug = slug;
      card.dataset.author = author;
      card.dataset.tags = tags.join('|');

      return {
        id: slug,
        slug: slug,
        title: title,
        excerpt: textOf(card.querySelector('.card-excerpt')),
        category: String(card.dataset.category || '').toLowerCase(),
        date: String(card.dataset.date || '').trim(),
        author: author,
        tags: tags,
        readTime: textOf(card.querySelector('.card-info')),
        card: card
      };
    });
  }

  /** The card of an admin post. Its article text is not included — see getPostContentHtml. */
  function renderPostCardHtml(post) {
    var title = escapeHtml(post.title || 'Untitled');
    var slug = escapeHtml(post.slug || normalizeToken(post.title));
    var category = escapeHtml(post.category || 'news');
    var categoryLabel = escapeHtml(String(post.category || 'news').replace(/^./, function (m) { return m.toUpperCase(); }));
    var authorName = post.author || 'Leo Editorial Team';
    var author = escapeHtml(authorName);
    var authorInitial = escapeHtml(authorName.charAt(0).toUpperCase());
    var dateIso = escapeHtml(post.date || '');
    var dateDisplay = escapeHtml(formatDisplayDate(post.date));
    var excerpt = escapeHtml(post.excerpt || 'New article update from the Leo Club of Moratuwa.');
    var readTime = escapeHtml(post.readTime || '3 min read');
    var icon = mapCategoryIcon(post.category);
    var avatarClass = avatarClassForCategory(post.category);
    var tags = (Array.isArray(post.tags) ? post.tags : []).map(function (t) { return String(t).replace(/\|/g, ' '); });

    var imageSrc = global.LEO_ENV && global.LEO_ENV.coverUrl ? global.LEO_ENV.coverUrl(post.coverImage, '') : '';
    var imageBlock = imageSrc
      ? '<img class="card-image" src="' + escapeHtml(imageSrc) + '" alt="' + categoryLabel + ' article cover" loading="lazy" onerror="this.style.display=\'none\'; this.parentElement.classList.remove(\'has-image\');" />'
      : '';

    return '' +
      '<article class="blog-card reveal" data-category="' + category + '" data-date="' + dateIso + '" data-slug="' + slug + '"' +
      ' data-post-id="' + escapeHtml(post.id) + '" data-author="' + author + '" data-tags="' + escapeHtml(tags.join('|')) + '">' +
      '  <div class="card-visual ' + category + (imageSrc ? ' has-image' : '') + '" aria-hidden="true">' +
      imageBlock +
      '    <i class="fas ' + icon + '"></i>' +
      '    <div class="card-badge">' + categoryLabel + '</div>' +
      '    <div class="card-read-hint">Click to Read</div>' +
      '  </div>' +
      '  <div class="card-body">' +
      '    <div class="post-meta">' +
      '      <span class="post-category ' + category + '">' + categoryLabel + '</span>' +
      '      <span class="post-date"><i class="far fa-calendar-alt" aria-hidden="true"></i> ' + dateDisplay + '</span>' +
      '    </div>' +
      '    <h3 class="card-title">' + title + '</h3>' +
      '    <p class="card-excerpt">' + excerpt + '</p>' +
      '    <div class="card-footer">' +
      '      <div class="post-author-sm">' +
      '        <div class="author-avatar-sm ' + avatarClass + '" aria-hidden="true">' + authorInitial + '</div>' +
      '        <span>' + author + '</span>' +
      '      </div>' +
      '      <div class="card-info"><i class="far fa-clock" aria-hidden="true"></i> ' + readTime + '</div>' +
      '    </div>' +
      '  </div>' +
      '</article>';
  }

  var staticProvider = {
    getRawArticleHtml: getRawArticleHtml,
    getPosts: getPublishedPosts,
    getPostContentHtml: getPostContentHtml,
    searchPosts: searchPosts,
    filterPosts: filterPosts,
    buildPostRecords: buildPostRecords
  };

  global.StaticContentProvider = staticProvider;

  if (global.ContentService && typeof global.ContentService.setProvider === 'function') {
    global.ContentService.setProvider(staticProvider);
  }
})(window);
