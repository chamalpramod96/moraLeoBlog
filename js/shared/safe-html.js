(function (global) {
  'use strict';

  // Article text written in the admin panel is HTML typed by an editor. Before
  // it is shown anywhere (the blog or the admin preview) it goes through
  // DOMPurify, which removes scripts and anything else that could run code in
  // a reader's browser. The library is fetched the first time it is needed.
  var PURIFY_URL = 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js';
  var OPTIONS = {
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select', 'option'],
  };

  var loading = null;

  function prepare(purify) {
    if (!purify || typeof purify.sanitize !== 'function') return null;
    if (!purify.__leoReady) {
      // Links in an article open in a new tab and can't reach back into this page
      purify.addHook('afterSanitizeAttributes', function (node) {
        if (node.tagName === 'A' && node.hasAttribute('href')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }
      });
      purify.__leoReady = true;
    }
    return purify;
  }

  function load() {
    var ready = prepare(global.DOMPurify);
    if (ready) return Promise.resolve(ready);

    if (!loading) {
      loading = new Promise(function (resolve) {
        var script = document.createElement('script');
        script.src = PURIFY_URL;
        script.crossOrigin = 'anonymous';
        script.referrerPolicy = 'no-referrer';
        script.onload = function () { resolve(prepare(global.DOMPurify)); };
        script.onerror = function () { resolve(null); };
        document.head.appendChild(script);
      });
    }
    return loading;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Used only when the library can't be loaded: the article's words, with every
  // tag dropped, one paragraph per block.
  function textOnly(html) {
    var doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    var blocks = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, figcaption');
    var lines = [];
    Array.prototype.forEach.call(blocks, function (block) {
      var text = (block.textContent || '').replace(/\s+/g, ' ').trim();
      if (text && !block.querySelector('p, li')) lines.push(text);
    });
    if (!lines.length) {
      var all = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
      if (all) lines.push(all);
    }
    return lines.map(function (line) { return '<p>' + escapeHtml(line) + '</p>'; }).join('');
  }

  /** Resolves to HTML that is safe to put on the page. */
  function clean(html) {
    return load().then(function (purify) {
      return purify ? purify.sanitize(String(html || ''), OPTIONS) : textOnly(html);
    });
  }

  global.SafeHtml = {
    clean: clean,
    escapeHtml: escapeHtml,
  };
})(window);
