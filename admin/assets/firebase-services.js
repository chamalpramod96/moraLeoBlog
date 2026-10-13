(function () {
  // Everything the admin panel asks of Firebase (the Mora Connect project).
  // What an account may actually do is decided by the security rules, not here.

  function assertConfig(cfg) {
    if (!cfg || !cfg.firebase || !cfg.firebase.projectId) {
      throw new Error("Missing Firebase settings (js/env-secrets.js).");
    }
  }

  function nowIso() {
    return new Date().toISOString();
  }

  const state = {
    app: null,
    auth: null,
    db: null,
    storage: null,
  };

  function initFirebase(config) {
    assertConfig(config);
    if (!firebase.apps.length) {
      state.app = firebase.initializeApp(config.firebase);
    } else {
      state.app = firebase.app();
    }
    state.auth = firebase.auth();
    state.db = firebase.firestore();
    state.storage = firebase.storage();

    if (config.emulators) {
      state.auth.useEmulator(config.emulators.auth, { disableWarnings: true });
      state.db.useEmulator(config.emulators.firestore.host, config.emulators.firestore.port);
      state.storage.useEmulator(config.emulators.storage.host, config.emulators.storage.port);
    }
    return state;
  }

  // ── Sign-in ────────────────────────────────────────────────────────────────

  // The sign-in is a Mora Connect one, so it is kept for this browser tab only
  // and is gone when the tab is closed.
  async function authSignIn(email, password) {
    await state.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    return state.auth.signInWithEmailAndPassword(String(email || "").trim().toLowerCase(), password);
  }

  function authSignOut() {
    return state.auth.signOut();
  }

  function onAuthChange(cb) {
    return state.auth.onAuthStateChanged(cb);
  }

  async function readOwnDoc(collection, email) {
    try {
      const doc = await state.db.collection(collection).doc(email).get();
      return doc.exists ? doc.data() : null;
    } catch (err) {
      if (err && err.code === "permission-denied") return null;
      throw err;
    }
  }

  /**
   * What is known about the signed-in account, from its own two records: its
   * Mora Connect member record (role, active or not) and, if it has one, its
   * entry in the blog's editors list.
   */
  async function getAccess(config) {
    const user = state.auth.currentUser;
    if (!user) return null;
    const email = String(user.email || "").toLowerCase();
    const [member, editor] = await Promise.all([
      readOwnDoc(config.collections.members, email),
      readOwnDoc(config.collections.editors, email),
    ]);
    return {
      uid: user.uid,
      email,
      isMember: !!member,
      activeMember: !!(member && member.isActive === true),
      memberRole: member ? member.role || "" : "",
      listedEditor: !!editor,
      name: (member && member.fullName) || (editor && editor.name) || email,
    };
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  function postsCollection(config) {
    return state.db.collection(config.collections.posts);
  }

  async function listPosts(config) {
    const snap = await postsCollection(config).orderBy("updatedAt", "desc").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  function newPostId(config) {
    return postsCollection(config).doc().id;
  }

  /** Writes the whole post. The rules check every field and who is saving. */
  async function savePost(config, id, post) {
    await postsCollection(config).doc(id).set(post);
  }

  async function deletePost(config, id) {
    await postsCollection(config).doc(id).delete();
  }

  /** Adds several posts in one go — all of them are saved, or none. */
  async function importPosts(config, posts) {
    const batch = state.db.batch();
    posts.forEach((post) => {
      batch.set(postsCollection(config).doc(newPostId(config)), post);
    });
    await batch.commit();
  }

  /** The list of published posts the public blog reads (one document). */
  async function writePublishedList(config, entries) {
    await state.db.doc(config.indexDoc).set({ posts: entries, updatedAt: nowIso() });
  }

  // ── Images ─────────────────────────────────────────────────────────────────

  /** Uploads a post's cover and returns its Storage path (that is what a post saves). */
  async function uploadCover(config, postId, blob, contentType) {
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contentType] || "jpg";
    const path = `${config.storage.postsPath}/${postId}/cover-${Date.now()}.${ext}`;
    await state.storage.ref().child(path).put(blob, {
      contentType,
      // The file name is new for every upload, so browsers may keep it for good
      cacheControl: "public, max-age=31536000, immutable",
    });
    return path;
  }

  /** Removes an uploaded image. Only officers may; a refusal is not an error here. */
  async function deleteImage(path) {
    try {
      await state.storage.ref().child(path).delete();
    } catch (err) {
      /* the post is already saved without it — a left-over file harms nothing */
    }
  }

  // ── Editors list (other members the officers let in) ───────────────────────

  function editorsCollection(config) {
    return state.db.collection(config.collections.editors);
  }

  async function listEditors(config) {
    const snap = await editorsCollection(config).get();
    return snap.docs
      .map((d) => ({ email: d.id, name: d.data().name || "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function saveEditor(config, email, name) {
    await editorsCollection(config).doc(email).set({ name });
  }

  async function removeEditor(config, email) {
    await editorsCollection(config).doc(email).delete();
  }

  window.AdminFirebase = {
    initFirebase,
    authSignIn,
    authSignOut,
    onAuthChange,
    getAccess,
    listPosts,
    newPostId,
    savePost,
    deletePost,
    importPosts,
    writePublishedList,
    uploadCover,
    deleteImage,
    listEditors,
    saveEditor,
    removeEditor,
    nowIso,
  };
})();
