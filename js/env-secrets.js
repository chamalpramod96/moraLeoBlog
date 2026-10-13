// The blog uses the Mora Connect Firebase project (the member portal) for
// editor sign-in, posts and images. These are that project's "web app"
// settings: they identify the project and are not passwords — every visitor's
// browser receives them. What protects the data is the security rules, which
// live in the moraLeoPortal project (see portal-rules/ here for the blog part).
window.__LEO_ENV__ = {
  site: {
    productionUrl: 'https://moraleoblog.vercel.app',
  },
  firebase: {
    apiKey: 'AIzaSyC-W6oL77kGlp_qMYhM2_X0lgfTU-sIb8w',
    authDomain: 'moraleoportal.firebaseapp.com',
    projectId: 'moraleoportal',
    storageBucket: 'moraleoportal.firebasestorage.app',
    messagingSenderId: '598095824768',
    appId: '1:598095824768:web:e9543508db9aa22b56a365',
  },
};
