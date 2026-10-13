(function (global) {
  'use strict';

  var rootEnv = global.__LEO_ENV__ || {};
  var site = rootEnv.site || {};
  var firebase = rootEnv.firebase || {};

  var productionUrl = String(site.productionUrl || 'https://moraleoblog.vercel.app').replace(/\/$/, '');

  // Local testing only: opening a page as http://localhost:<port>/…?emulators=1
  // points everything at the Firebase emulators under a demo- project, so
  // nothing in the real Mora Connect project can be read or changed.
  var isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(global.location.hostname);
  var useEmulators = isLocalHost && /[?&]emulators=1(&|$)/.test(global.location.search);

  var firebaseConfig = useEmulators
    ? {
        apiKey: 'demo-key',
        authDomain: 'demo-moraleo.firebaseapp.com',
        projectId: 'demo-moraleo',
        storageBucket: 'demo-moraleo.appspot.com',
        messagingSenderId: '',
        appId: 'demo-app',
      }
    : {
        apiKey: firebase.apiKey || '',
        authDomain: firebase.authDomain || '',
        projectId: firebase.projectId || '',
        storageBucket: firebase.storageBucket || '',
        messagingSenderId: firebase.messagingSenderId || '',
        appId: firebase.appId || '',
      };

  var firestoreUrl = useEmulators ? 'http://127.0.0.1:8181/v1' : 'https://firestore.googleapis.com/v1';
  var storageUrl = useEmulators ? 'http://127.0.0.1:9198/v0' : 'https://firebasestorage.googleapis.com/v0';

  // A post's cover is saved as a Storage path (blog/<post>/<file>) or as a file
  // of this site (images/…) — never a full URL. This turns either into an
  // address the browser can load. `siteBase` is where the site's own files are
  // from the current page ('' on the blog, '../' on the admin page).
  function coverUrl(path, siteBase) {
    var value = String(path || '');
    if (/^blog\/[^/]+\/[^/]+$/.test(value)) {
      return storageUrl + '/b/' + encodeURIComponent(firebaseConfig.storageBucket) +
        '/o/' + encodeURIComponent(value) + '?alt=media';
    }
    if (/^images\/[A-Za-z0-9/_.-]+$/.test(value)) {
      return (siteBase || '') + value;
    }
    return '';
  }

  global.LEO_ENV = {
    site: {
      productionUrl: productionUrl,
    },
    firebase: firebaseConfig,
    coverUrl: coverUrl,
  };

  global.ADMIN_CONFIG = {
    firebase: firebaseConfig,
    emulators: useEmulators
      ? {
          auth: 'http://127.0.0.1:9099',
          firestore: { host: '127.0.0.1', port: 8181 },
          storage: { host: '127.0.0.1', port: 9198 },
        }
      : null,
    collections: {
      posts: 'blogPosts',
      editors: 'blogEditors',
      members: 'members',
    },
    indexDoc: 'blogIndex/current',
    storage: {
      postsPath: 'blog',
    },
  };

  global.FIREBASE_CONTENT_CONFIG = {
    projectId: firebaseConfig.projectId,
    postsCollection: 'blogPosts',
    indexDoc: 'blogIndex/current',
    firestoreUrl: firestoreUrl,
  };
})(window);
