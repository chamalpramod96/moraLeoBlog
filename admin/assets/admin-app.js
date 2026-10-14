/**
 * admin-app.js — the blog admin panel
 * ─────────────────────────────────────────────────────────────────────────────
 * Laid out like the club website's admin: a list of posts with Edit / Delete on
 * each row, and an add / edit form with a live preview beside it.
 *
 *   §1  Helpers ............... toasts, the confirm dialog, error wording
 *   §2  Sign in / sign out .... who may use the panel
 *   §3  Posts list ............ search, status tabs, rows
 *   §4  Add / edit form ....... fields, permissions, cover picture, preview
 *   §5  Saving and deleting ... what is written to Mora Connect
 *   §6  Import ................ copying the site's hand-written articles in
 *   §7  Editors ............... other members the officers let in
 *   §8  Start-up
 *
 * What an account may really do is decided by the security rules in Mora
 * Connect; this file only decides what the screen offers.
 */
(function () {
  const cfg = window.ADMIN_CONFIG;
  const svc = window.AdminFirebase;
  const env = window.LEO_ENV;
  const safe = window.SafeHtml;

  const $ = (id) => document.getElementById(id);

  const els = {
    bootView: $("bootView"),
    loginView: $("loginView"),
    appView: $("appView"),
    loginForm: $("loginForm"),
    loginEmail: $("loginEmail"),
    loginPassword: $("loginPassword"),
    togglePassword: $("togglePassword"),
    loginError: $("loginError"),
    loginBtn: $("loginBtn"),
    logoutBtn: $("logoutBtn"),
    userName: $("userName"),
    userRole: $("userRole"),
    navEditors: $("navEditors"),

    postsSection: $("postsSection"),
    editorSection: $("editorSection"),
    editorsSection: $("editorsSection"),

    countLine: $("countLine"),
    importBtn: $("importBtn"),
    newPostBtn: $("newPostBtn"),
    postSearch: $("postSearch"),
    statusTabs: $("statusTabs"),
    postList: $("postList"),
    emptyState: $("emptyState"),
    rebuildNote: $("rebuildNote"),
    rebuildBtn: $("rebuildBtn"),

    backBtn: $("backBtn"),
    editorTitle: $("editorTitle"),
    statusBadge: $("statusBadge"),
    lockNote: $("lockNote"),
    postForm: $("postForm"),
    postTitle: $("postTitle"),
    postSlug: $("postSlug"),
    postExcerpt: $("postExcerpt"),
    postCategory: $("postCategory"),
    postTags: $("postTags"),
    postAuthor: $("postAuthor"),
    postReadTime: $("postReadTime"),
    postDate: $("postDate"),
    postFeatured: $("postFeatured"),
    dropzone: $("dropzone"),
    coverUpload: $("coverUpload"),
    coverName: $("coverName"),
    coverNote: $("coverNote"),
    removeCoverBtn: $("removeCoverBtn"),
    seoTitle: $("seoTitle"),
    seoDescription: $("seoDescription"),
    seoKeywords: $("seoKeywords"),
    formError: $("formError"),

    deleteBtn: $("deleteBtn"),
    cancelBtn: $("cancelBtn"),
    unpublishBtn: $("unpublishBtn"),
    saveBtn: $("saveBtn"),
    reviewBtn: $("reviewBtn"),
    publishBtn: $("publishBtn"),

    previewImage: $("previewImage"),
    previewIcon: $("previewIcon"),
    previewBadge: $("previewBadge"),
    previewCategory: $("previewCategory"),
    previewDate: $("previewDate"),
    previewTitle: $("previewTitle"),
    previewExcerpt: $("previewExcerpt"),
    previewAuthor: $("previewAuthor"),
    previewRead: $("previewRead"),
    previewContent: $("previewContent"),

    editorForm: $("editorForm"),
    editorEmail: $("editorEmail"),
    editorName: $("editorName"),
    editorsList: $("editorsList"),

    confirmDialog: $("confirmDialog"),
    confirmIcon: $("confirmIcon"),
    confirmTitle: $("confirmTitle"),
    confirmText: $("confirmText"),
    confirmCancel: $("confirmCancel"),
    confirmOk: $("confirmOk"),
    toasts: $("toasts"),
  };

  const navItems = Array.from(document.querySelectorAll(".nav-item"));

  const appState = {
    posts: [],
    editor: null,        // the rich-text editor
    access: null,        // who is signed in: { uid, email, name, memberRole, blogRole: "officer" | "editor" }
    section: "posts",    // "posts" (the list), "editor" (add / edit a post) or "editors"
    statusFilter: "all",
    loadedPost: null,    // the post in the form; null while writing a new one
    coverPath: "",       // the cover the post has now (a Storage path or a site file)
    pickedCover: null,   // a new picture chosen in the form, uploaded on save
    localPreviewImageUrl: null,
    filling: false,      // the form is being filled by the panel, not typed in
    dirty: false,        // the form has changes that are not saved
    busy: false,
    loginMessage: "",    // shown on the sign-in screen the next time it appears (e.g. "Access denied: …")
  };

  const slugify = window.TextUtils.slugify;
  const splitCsv = window.TextUtils.splitCsv;
  const esc = safe.escapeHtml;

  // The same categories as the tabs on the blog
  const CATEGORIES = ["news", "events", "service", "leadership", "education", "environment", "health", "technology", "stories", "achievements"];
  const STATUS_LABELS = { draft: "Draft", review: "Waiting for review", published: "Published" };
  const STATUS_PILL = { draft: "draft", review: "review", published: "live" };

  // The Mora Connect roles that run the blog — the same three that may use the club website's admin.
  // Kept in step with isAdmin() in the portal's rules.
  const OFFICER_ROLES = ["secretary", "president", "superAdmin"];
  const ROLE_LABELS = { secretary: "Secretary", president: "President", superAdmin: "Super Admin", member: "Member" };
  const OFFICERS_TEXT = "the Secretary, President and Super Admin";

  // Kept in step with the rules (portal-rules/firestore-blog.rules), so a post
  // that is too long is explained here instead of being refused there
  const LIMITS = { title: 200, slug: 120, excerpt: 600, author: 100, readTime: 30, tags: 15, content: 300000 };
  const COVER_MAX_SIDE = 1600;
  const COVER_MAX_BYTES = 3 * 1024 * 1024;


  // ───────────────────────────────────────────────────────────────────────────
  // §1  HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  const capitalise = (value) => String(value || "").replace(/^./, (m) => m.toUpperCase());
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function toast(message, isError) {
    const node = document.createElement("div");
    node.className = `toast ${isError ? "error" : "success"}`;
    const icon = document.createElement("i");
    icon.className = `fas ${isError ? "fa-circle-exclamation" : "fa-circle-check"}`;
    const text = document.createElement("span");
    text.textContent = message;
    node.append(icon, text);
    els.toasts.append(node);
    setTimeout(() => node.remove(), isError ? 7000 : 4000);
  }

  /**
   * Resolves true only if the person presses the dialog's main button.
   * `calm` is for questions that delete nothing (leaving a page, importing).
   */
  function askConfirm({ title, text, okLabel, icon, calm }) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmText.textContent = text;
      els.confirmOk.querySelector("span").textContent = okLabel || "Delete";
      els.confirmOk.className = calm ? "btn btn-primary" : "btn btn-danger";
      els.confirmIcon.className = calm ? "dialog-icon calm" : "dialog-icon";
      els.confirmIcon.firstElementChild.className = `fas ${icon || "fa-trash"}`;
      els.confirmDialog.hidden = false;
      els.confirmCancel.focus();

      const onKey = (e) => { if (e.key === "Escape") done(false); };
      function done(answer) {
        els.confirmDialog.hidden = true;
        els.confirmOk.onclick = els.confirmCancel.onclick = null;
        document.removeEventListener("keydown", onKey);
        resolve(answer);
      }
      els.confirmOk.onclick = () => done(true);
      els.confirmCancel.onclick = () => done(false);
      document.addEventListener("keydown", onKey);
    });
  }

  function describeError(err) {
    const code = String((err && err.code) || "");
    if (code === "permission-denied" || code === "storage/unauthorized") {
      return "You don't have permission to do this. If your role changed, sign out and in again.";
    }
    if (code === "auth/network-request-failed" || code === "unavailable") {
      return "No connection. Check the internet and try again.";
    }
    return (err && err.message) || "Something went wrong.";
  }

  /** What the sign-in screen says when a sign-in fails — the same words as the club website's admin. */
  function signInErrorMessage(err) {
    const code = String((err && err.code) || "");
    if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email", "auth/missing-password"].includes(code)) {
      return "Invalid email or password.";
    }
    if (code === "auth/too-many-requests") return "Too many failed attempts. Please try again later.";
    if (code === "auth/user-disabled") return "This Mora Connect account has been disabled.";
    if (code === "auth/network-request-failed") {
      return "Could not reach Mora Connect’s sign-in service. Check your internet connection and try again.";
    }
    // The details are for whoever looks after the site, not for the sign-in screen
    console.error("[sign-in]", err);
    return "Mora Connect’s sign-in service is not accepting sign-ins from this website right now.";
  }

  function hasFirebaseConfig() {
    const fb = cfg && cfg.firebase ? cfg.firebase : null;
    return !!(fb && fb.apiKey && fb.projectId && fb.authDomain && fb.storageBucket && fb.appId);
  }

  /** Secretary, President or Super Admin: may publish, delete and manage the editors list. */
  const isOfficer = () => !!appState.access && appState.access.blogRole === "officer";

  /** New posts: anyone signed in. Existing ones: an officer, or the writer until it is published. */
  function canEdit(post) {
    if (!appState.access) return false;
    if (isOfficer() || !post) return true;
    return post.createdByUid === appState.access.uid && post.status !== "published";
  }

  function todayLocal() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** "2026-07-19" → "19 Jul 2026". A calendar day, so it reads the same in every time zone. */
  function formatDay(isoDay) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || ""));
    if (!m) return "";
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    });
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §2  SIGN IN / SIGN OUT
  // ───────────────────────────────────────────────────────────────────────────

  /** One of: "boot" (checking who is signed in), "login", "admin". */
  function showView(name) {
    els.bootView.hidden = name !== "boot";
    els.loginView.hidden = name !== "login";
    els.appView.hidden = name !== "admin";
    setLoginBusy(false);
  }

  function setLoginBusy(busy) {
    els.loginBtn.querySelector("span").textContent = busy ? "Signing in…" : "Sign in";
    els.loginBtn.disabled = busy;
  }

  function showLoginError(message) {
    els.loginError.textContent = message;
    els.loginError.hidden = !message;
    if (!message) return;
    els.loginForm.classList.remove("shake");
    void els.loginForm.offsetWidth; // restart the animation if it is already running
    els.loginForm.classList.add("shake");
  }

  /** Signs the account out and says why on the sign-in screen (see leaveAdmin). */
  async function refuse(message) {
    appState.loginMessage = message;
    await svc.authSignOut();
  }

  /**
   * Who gets in: an active Mora Connect member who is Secretary, President or
   * Super Admin — or one those officers put on the blog's editors list.
   * (The rules in Mora Connect enforce the same thing; this is what the screen says.)
   */
  async function enterAdmin() {
    const access = await svc.getAccess(cfg);
    if (!access) return;

    if (!access.isMember) {
      await refuse("Access denied: this account is not registered as a member in Mora Connect.");
      return;
    }
    if (!access.activeMember) {
      await refuse("Access denied: your Mora Connect account is not an active member.");
      return;
    }
    const officer = OFFICER_ROLES.includes(access.memberRole);
    if (!officer && !access.listedEditor) {
      const role = ROLE_LABELS[access.memberRole] || access.memberRole || "not set";
      await refuse(`Access denied: only ${OFFICERS_TEXT} can sign in here. Your Mora Connect role is ${role}.`);
      return;
    }

    access.blogRole = officer ? "officer" : "editor";
    appState.access = access;

    try {
      await refreshPosts();
    } catch (err) {
      if (err && err.code === "permission-denied") {
        // The account is fine; the blog's part of the Mora Connect rules is not deployed yet
        await refuse("Your sign-in worked, but the blog is not switched on in Mora Connect yet (its security rules have not been deployed).");
        return;
      }
      throw err;
    }

    els.userName.textContent = access.name;
    els.userName.title = access.email;
    els.userRole.textContent = officer ? ROLE_LABELS[access.memberRole] : "Editor";
    els.navEditors.hidden = !officer;
    els.rebuildNote.hidden = !officer;
    showView("admin");
    showSection("posts");
  }

  /** Signed out: nothing of the last person's work stays on the page. */
  function leaveAdmin() {
    appState.access = null;
    appState.posts = [];
    appState.loadedPost = null;
    appState.coverPath = "";
    appState.pickedCover = null;
    appState.dirty = false;
    els.confirmDialog.hidden = true;
    els.postList.innerHTML = "";
    els.editorsList.innerHTML = "";
    els.postSearch.value = "";
    els.postForm.reset();
    if (appState.editor) {
      appState.filling = true;
      appState.editor.setData("");
      appState.filling = false;
    }
    els.userName.textContent = "";
    els.userRole.textContent = "";
    showView("login");
    showLoginError(appState.loginMessage);
    appState.loginMessage = "";
    els.loginEmail.focus();
  }

  /** True if it is fine to leave the form: nothing unsaved, or the person agrees to lose it. */
  async function okToLeaveForm() {
    if (appState.section !== "editor" || !appState.dirty) return true;
    return askConfirm({
      title: "Leave without saving?",
      text: "The changes you made to this post will be lost.",
      okLabel: "Leave",
      icon: "fa-arrow-right-from-bracket",
      calm: true,
    });
  }

  function showSection(name) {
    appState.section = name;
    els.postsSection.hidden = name !== "posts";
    els.editorSection.hidden = name !== "editor";
    els.editorsSection.hidden = name !== "editors";
    const highlighted = name === "editor" ? "posts" : name;
    navItems.forEach((btn) => btn.classList.toggle("active", btn.dataset.section === highlighted));
    window.scrollTo(0, 0);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §3  POSTS LIST
  // ───────────────────────────────────────────────────────────────────────────

  async function refreshPosts() {
    appState.posts = await svc.listPosts(cfg);
    renderPosts();
  }

  function renderTabs(counts) {
    const tabs = [
      ["all", "All", appState.posts.length],
      ["draft", "Drafts", counts.draft],
      ["review", "Waiting for review", counts.review],
      ["published", "Published", counts.published],
    ];
    els.statusTabs.innerHTML = tabs.map(([value, label, count]) => `
      <button type="button" class="tab${appState.statusFilter === value ? " active" : ""}" role="tab"
        aria-selected="${appState.statusFilter === value}" data-status="${value}">${label}<b>${count}</b></button>
    `).join("");
  }

  function rowHtml(post) {
    const status = STATUS_LABELS[post.status] ? post.status : "draft";
    const editable = canEdit(post);
    const mine = post.createdByUid === appState.access.uid;
    const cover = env.coverUrl(post.coverImage, "/");
    const meta = [
      capitalise(post.category),
      formatDay(post.date) || "No date yet",
      post.author ? `By ${post.author}` : "",
      mine && !isOfficer() ? "yours" : "",
    ].filter(Boolean).join(" · ");

    return `
      <div class="row" data-id="${esc(post.id)}">
        ${cover
          ? `<img class="row-thumb" src="${esc(cover)}" alt="" loading="lazy" />`
          : '<div class="row-thumb placeholder"><i class="fas fa-image"></i></div>'}
        <div class="row-main">
          <h3>
            <button type="button" class="row-title" data-act="open">${esc(post.title || "Untitled")}</button>
            <span class="pill ${STATUS_PILL[status]}">${STATUS_LABELS[status]}</span>
            ${post.featured ? '<span class="pill featured">Featured</span>' : ""}
          </h3>
          <p class="row-meta">${esc(meta)}</p>
        </div>
        <div class="row-actions">
          ${status === "published"
            ? `<a class="btn btn-ghost btn-sm btn-icon" href="/?post=${encodeURIComponent(post.slug)}" target="_blank" rel="noopener" title="Open on the blog" aria-label="Open on the blog"><i class="fas fa-arrow-up-right-from-square"></i></a>`
            : ""}
          <button type="button" class="btn btn-ghost btn-sm" data-act="open">
            <i class="fas ${editable ? "fa-pen" : "fa-eye"}"></i><span>${editable ? "Edit" : "View"}</span>
          </button>
          ${editable
            ? '<button type="button" class="btn btn-ghost btn-sm btn-icon btn-delete" data-act="delete" title="Delete" aria-label="Delete"><i class="fas fa-trash"></i></button>'
            : ""}
        </div>
      </div>
    `;
  }

  function renderPosts() {
    const posts = appState.posts;
    const counts = { draft: 0, review: 0, published: 0 };
    posts.forEach((p) => { if (counts[p.status] !== undefined) counts[p.status] += 1; });

    els.countLine.textContent = posts.length
      ? [plural(posts.length, "post", "posts"), `${counts.published} published`,
        plural(counts.draft, "draft", "drafts"), `${counts.review} waiting for review`].join(" · ")
      : "Nothing written here yet.";
    renderTabs(counts);

    const q = els.postSearch.value.trim().toLowerCase();
    const shown = posts.filter((p) => {
      const matchesQuery = !q || [p.title, p.author, p.category].join(" ").toLowerCase().includes(q);
      const matchesStatus = appState.statusFilter === "all" || p.status === appState.statusFilter;
      return matchesQuery && matchesStatus;
    });
    // Work in progress first (latest change on top), then what is on the blog, newest first
    const unpublished = (p) => (p.status === "published" ? 0 : 1);
    shown.sort((a, b) =>
      unpublished(b) - unpublished(a) ||
      (unpublished(a)
        ? String(b.updatedAt).localeCompare(String(a.updatedAt))
        : String(b.date).localeCompare(String(a.date))));

    els.postList.innerHTML = shown.map(rowHtml).join("");
    els.emptyState.hidden = shown.length > 0;
    if (!shown.length) {
      els.emptyState.querySelector("span").textContent = posts.length
        ? "No posts match. Try another search, or the “All” tab."
        : "No posts yet. Press “New post” to write the first one.";
    }

    if (isOfficer()) {
      const waiting = siteArticlesToImport().length;
      els.importBtn.hidden = waiting === 0;
      els.importBtn.querySelector("span").textContent = `Import ${plural(waiting, "site article", "site articles")}`;
    } else {
      els.importBtn.hidden = true;
    }
  }

  function onPostListClick(event) {
    const control = event.target.closest("[data-act]");
    if (!control) return;
    const row = control.closest(".row");
    const post = appState.posts.find((p) => p.id === row.getAttribute("data-id"));
    if (!post) return;
    if (control.getAttribute("data-act") === "delete") deletePost(post);
    else openEditor(post);
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §4  ADD / EDIT FORM
  // ───────────────────────────────────────────────────────────────────────────

  function fillCategories() {
    els.postCategory.innerHTML = CATEGORIES.map((c) => `<option value="${c}">${capitalise(c)}</option>`).join("");
  }

  function hasSlugConflict(slugValue, currentId) {
    return appState.posts.some((p) => p.slug === slugValue && p.id !== currentId);
  }

  function showFormError(message) {
    els.formError.textContent = message;
    els.formError.hidden = !message;
    if (message) els.formError.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function readForm() {
    return {
      title: els.postTitle.value.trim(),
      slug: els.postSlug.value.trim(),
      excerpt: els.postExcerpt.value.trim(),
      category: els.postCategory.value,
      tags: splitCsv(els.postTags.value),
      author: els.postAuthor.value.trim(),
      readTime: els.postReadTime.value.trim(),
      date: els.postDate.value,
      featured: els.postFeatured.value === "true",
      contentHtml: appState.editor ? appState.editor.getData() : "",
      seo: {
        title: els.seoTitle.value.trim(),
        description: els.seoDescription.value.trim(),
        keywords: splitCsv(els.seoKeywords.value),
      },
    };
  }

  /** Puts a post into the form — or, with nothing, starts an empty new one. */
  function writeForm(post) {
    const p = post || {};
    const seo = p.seo || {};
    appState.filling = true;
    appState.loadedPost = post || null;
    appState.coverPath = p.coverImage || "";
    appState.pickedCover = null;

    els.postTitle.value = p.title || "";
    els.postSlug.value = p.slug || "";
    els.postExcerpt.value = p.excerpt || "";
    els.postCategory.value = CATEGORIES.includes(p.category) ? p.category : CATEGORIES[0];
    els.postTags.value = (p.tags || []).join(", ");
    els.postAuthor.value = post ? p.author || "" : appState.access.name;
    els.postReadTime.value = p.readTime || "";
    els.postDate.value = p.date || "";
    els.postFeatured.value = String(!!p.featured);
    els.coverUpload.value = "";
    els.seoTitle.value = seo.title || "";
    els.seoDescription.value = seo.description || "";
    els.seoKeywords.value = (seo.keywords || []).join(", ");
    if (appState.editor) appState.editor.setData(p.contentHtml || "");

    appState.filling = false;
    appState.dirty = false;
    showFormError("");
    applyPermissions();
    renderPreview();
  }

  function openEditor(post) {
    writeForm(post || null);
    showSection("editor");
    if (!post) els.postTitle.focus();
  }

  async function closeEditor() {
    if (!(await okToLeaveForm())) return;
    appState.dirty = false;
    renderPosts();
    showSection("posts");
  }

  /** Shows the buttons this person may use on the post in the form, and locks the rest. */
  function applyPermissions() {
    const post = appState.loadedPost;
    const status = post ? post.status : "draft";
    const editable = canEdit(post);
    const officer = isOfficer();

    els.editorTitle.textContent = !post ? "New post" : editable ? "Edit post" : "View post";
    els.statusBadge.textContent = post ? STATUS_LABELS[status] : "Not saved yet";
    els.statusBadge.className = `pill ${STATUS_PILL[status]}`;

    els.lockNote.hidden = editable;
    if (!editable) {
      els.lockNote.querySelector("span").textContent = status === "published"
        ? "This post is published. Only the Secretary, President or Super Admin can change it."
        : "This post belongs to another editor. You can read it, but not change it.";
    }

    Array.from(els.postForm.querySelectorAll("input, textarea, select")).forEach((field) => {
      field.disabled = !editable;
    });
    // Featuring a post is the officers' decision
    els.postFeatured.disabled = !editable || !officer;
    els.dropzone.classList.toggle("disabled", !editable);
    if (appState.editor) {
      if (editable) appState.editor.disableReadOnlyMode("blog-admin");
      else appState.editor.enableReadOnlyMode("blog-admin");
    }

    els.saveBtn.hidden = !editable;
    els.reviewBtn.hidden = !(editable && !officer && status === "draft");
    els.publishBtn.hidden = !(officer && status !== "published");
    els.unpublishBtn.hidden = !(editable && post && status !== "draft");
    els.unpublishBtn.querySelector("span").textContent = status === "published" ? "Unpublish" : "Back to draft";
    els.deleteBtn.hidden = !(editable && post);
    els.cancelBtn.querySelector("span").textContent = editable ? "Cancel" : "Back";

    renderCover();
  }

  function setBusy(busy) {
    appState.busy = busy;
    [els.saveBtn, els.reviewBtn, els.publishBtn, els.unpublishBtn, els.deleteBtn, els.cancelBtn,
      els.importBtn, els.rebuildBtn, els.newPostBtn].forEach((btn) => {
      btn.disabled = busy;
    });
  }

  function markDirty() {
    if (!appState.filling) appState.dirty = true;
  }

  // ── Cover picture ──

  function renderCover() {
    const editable = canEdit(appState.loadedPost);
    const picked = appState.pickedCover;
    els.dropzone.classList.toggle("has-file", !!(picked || appState.coverPath));
    els.coverName.textContent = picked
      ? picked.name
      : appState.coverPath ? "This post has a cover picture" : "Choose a picture or drop it here";
    els.coverNote.textContent = picked
      ? "It is uploaded when you save."
      : appState.coverPath ? "Choose another picture to replace it." : "JPG, PNG or WebP. Large photos are made smaller for you.";
    els.removeCoverBtn.hidden = !(editable && (picked || appState.coverPath));
  }

  function pickCover(file) {
    if (!file || !canEdit(appState.loadedPost)) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast("Use a JPG, PNG or WebP picture for the cover.", true);
      return;
    }
    appState.pickedCover = file;
    markDirty();
    renderCover();
    renderPreview();
  }

  function loadPicture(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("This picture could not be read. Try another one.")); };
      img.src = url;
    });
  }

  /** A phone photo is several MB; the blog needs far less. Returns what to upload. */
  async function shrinkPicture(file) {
    const img = await loadPicture(file);
    const scale = Math.min(1, COVER_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && file.size <= 400 * 1024) {
      return { blob: file, type: file.type };
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // a see-through PNG would otherwise turn black as a JPG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("This picture could not be read. Try another one.");
    if (blob.size >= COVER_MAX_BYTES) throw new Error("This picture is too large even after shrinking. Try another one.");
    return { blob, type: "image/jpeg" };
  }

  // ── Preview (beside the form) ──

  function releaseLocalPreviewImage() {
    if (appState.localPreviewImageUrl) {
      URL.revokeObjectURL(appState.localPreviewImageUrl);
      appState.localPreviewImageUrl = null;
    }
  }

  let previewRun = 0;

  async function renderPreview() {
    const p = readForm();
    const category = capitalise(p.category);
    els.previewTitle.textContent = p.title || "Your title will show here";
    els.previewExcerpt.textContent = p.excerpt || "The short summary will show here.";
    els.previewCategory.textContent = category;
    els.previewBadge.textContent = category;
    els.previewDate.textContent = formatDay(p.date) || "Dated when published";
    els.previewAuthor.textContent = p.author || "Leo Editorial Team";
    els.previewRead.textContent = p.readTime || "3 min read";

    releaseLocalPreviewImage();
    if (appState.pickedCover) {
      appState.localPreviewImageUrl = URL.createObjectURL(appState.pickedCover);
    }
    const imageUrl = appState.localPreviewImageUrl || env.coverUrl(appState.coverPath, "/");
    if (imageUrl) {
      els.previewImage.src = imageUrl;
    } else {
      els.previewImage.removeAttribute("src");
    }
    els.previewImage.hidden = !imageUrl;
    els.previewIcon.hidden = !!imageUrl;

    // Shown exactly as the blog will show it: cleaned of anything that could run code
    const run = ++previewRun;
    const html = await safe.clean(p.contentHtml);
    if (run === previewRun) {
      els.previewContent.innerHTML = html || '<p class="pv-empty">The article will show here as you write.</p>';
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §5  SAVING AND DELETING
  // ───────────────────────────────────────────────────────────────────────────

  /** A message if the form can't be saved as it is, otherwise "". */
  function formProblem(form, slug, currentId) {
    if (!form.title) return "Give the post a title.";
    if (form.title.length > LIMITS.title) return `The title is too long (at most ${LIMITS.title} characters).`;
    if (!slug) return "Open “Link and search settings” and type a link name using English letters or numbers.";
    if (slug.length > LIMITS.slug) return `The link name is too long (at most ${LIMITS.slug} characters).`;
    if (hasSlugConflict(slug, currentId)) return "Another post already uses this link name. Change it under “Link and search settings”.";
    if (form.excerpt.length > LIMITS.excerpt) return `The short summary is too long (at most ${LIMITS.excerpt} characters).`;
    if (form.tags.length > LIMITS.tags) return `Too many tags (at most ${LIMITS.tags}).`;
    if (form.contentHtml.length > LIMITS.content) return "The article is too long to save. Please shorten it.";
    return "";
  }

  /** The list the public blog reads: one entry per published post, no article text. */
  async function publishList() {
    const entries = appState.posts
      .filter((p) => p.status === "published")
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt || "",
        category: p.category,
        author: p.author || "",
        date: p.date || "",
        readTime: p.readTime || "",
        tags: p.tags || [],
        coverImage: p.coverImage || "",
        featured: !!p.featured,
      }));
    try {
      await svc.writePublishedList(cfg, entries);
      return true;
    } catch (err) {
      toast("Saved, but the blog's list of posts could not be updated. Use “Refresh the blog's list” under the posts.", true);
      return false;
    }
  }

  /** `targetStatus` moves the post to that status; without it the post keeps the one it has. */
  async function savePost(targetStatus) {
    if (appState.busy) return;
    const post = appState.loadedPost;
    if (!canEdit(post)) {
      toast("You can't change this post.", true);
      return;
    }

    const form = readForm();
    const slug = slugify(form.slug || form.title);
    els.postSlug.value = slug;
    const problem = formProblem(form, slug, post ? post.id : null);
    if (problem) {
      showFormError(problem);
      return;
    }
    showFormError("");

    const status = targetStatus || (post ? post.status : "draft");
    if (status === "published" && !isOfficer()) {
      showFormError("Only the Secretary, President or Super Admin can publish. Send it for review instead.");
      return;
    }
    // A published post always has a date; it is set once and then left alone
    const date = form.date || (status === "published" ? todayLocal() : "");

    setBusy(true);
    try {
      const id = post ? post.id : svc.newPostId(cfg);
      const wasPublished = !!post && post.status === "published";
      const previousCover = post ? post.coverImage || "" : "";

      let coverImage = appState.coverPath;
      if (appState.pickedCover) {
        const picture = await shrinkPicture(appState.pickedCover);
        coverImage = await svc.uploadCover(cfg, id, picture.blob, picture.type);
      }

      const now = svc.nowIso();
      await svc.savePost(cfg, id, {
        title: form.title,
        slug,
        excerpt: form.excerpt,
        category: form.category,
        tags: form.tags,
        author: form.author.slice(0, LIMITS.author),
        readTime: form.readTime.slice(0, LIMITS.readTime),
        status,
        featured: isOfficer() ? form.featured : !!(post && post.featured),
        coverImage,
        contentHtml: form.contentHtml,
        seo: form.seo,
        date,
        publishedAt: (post && post.publishedAt) || (status === "published" ? now : ""),
        createdAt: post ? post.createdAt : now,
        updatedAt: now,
        createdByUid: post ? post.createdByUid : appState.access.uid,
        updatedByUid: appState.access.uid,
      });

      if (previousCover && previousCover !== coverImage && previousCover.startsWith(`${cfg.storage.postsPath}/`) && isOfficer()) {
        await svc.deleteImage(previousCover);
      }

      await refreshPosts();
      const listOk = isOfficer() && (wasPublished || status === "published") ? await publishList() : true;
      const saved = appState.posts.find((p) => p.id === id) || null;

      // "Publish" and "Send for review" finish the job, so they go back to the
      // list; a plain save stays on the form so the writing can go on
      if (targetStatus === "published" || targetStatus === "review") {
        appState.dirty = false;
        showSection("posts");
      } else {
        writeForm(saved);
      }

      if (listOk) {
        toast(
          targetStatus === "published" ? "Published — it is on the blog now."
            : targetStatus === "review" ? "Sent for review. An officer will publish it."
              : targetStatus === "draft" && wasPublished ? "Unpublished — it is a draft again."
                : "Saved."
        );
      }
    } catch (err) {
      showFormError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  /** Asks first. Works from a row in the list and from the form. */
  async function deletePost(post) {
    if (appState.busy || !post || !canEdit(post)) return;
    const ok = await askConfirm({
      title: `Delete “${post.title || "Untitled"}”?`,
      text: post.status === "published"
        ? "It will be taken off the blog. This cannot be undone."
        : "This cannot be undone.",
    });
    if (!ok) return;

    setBusy(true);
    try {
      await svc.deletePost(cfg, post.id);
      if (isOfficer() && String(post.coverImage || "").startsWith(`${cfg.storage.postsPath}/`)) {
        await svc.deleteImage(post.coverImage);
      }
      await refreshPosts();
      const listOk = isOfficer() && post.status === "published" ? await publishList() : true;
      if (appState.section === "editor") {
        appState.dirty = false;
        showSection("posts");
      }
      if (listOk) toast("Post deleted.");
    } catch (err) {
      toast(describeError(err), true);
    } finally {
      setBusy(false);
    }
  }

  async function rebuildPublicList() {
    if (appState.busy) return;
    setBusy(true);
    try {
      await refreshPosts();
      if (await publishList()) toast("The blog's list of posts is up to date.");
    } catch (err) {
      toast(describeError(err), true);
    } finally {
      setBusy(false);
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §6  IMPORT OF THE SITE'S HAND-WRITTEN ARTICLES (officers)
  // ───────────────────────────────────────────────────────────────────────────

  let siteArticles = null;

  /** Reads the articles in js/articles/*.js into the same shape as a post. */
  function readSiteArticles() {
    if (siteArticles) return siteArticles;
    const holder = document.createElement("template"); // keeps the HTML inert while it is read
    holder.innerHTML = (window.BLOG_ARTICLES_PARTS || []).join("\n");

    siteArticles = Array.from(holder.content.querySelectorAll("article.blog-card")).map((card) => {
      const text = (selector) => {
        const el = card.querySelector(selector);
        return el ? el.textContent.replace(/\s+/g, " ").trim() : "";
      };
      const title = text(".card-title");
      const image = card.querySelector("img.card-image");
      const cover = image ? image.getAttribute("src") || "" : "";

      let contentHtml = "";
      let tags = [];
      const template = card.querySelector("template.post-full-content");
      if (template) {
        const body = template.content.cloneNode(true);
        tags = Array.from(body.querySelectorAll(".content-tags .tag")).map((t) => t.textContent.trim()).filter(Boolean);
        // The blog adds the heading, the date line and the tags itself
        body.querySelectorAll(".content-tags, .content-meta").forEach((node) => node.remove());
        const heading = body.querySelector("h2");
        if (heading) heading.remove();
        const box = document.createElement("div");
        box.appendChild(body);
        contentHtml = box.innerHTML.trim();
      }

      return {
        title,
        slug: slugify(title),
        excerpt: text(".card-excerpt").slice(0, LIMITS.excerpt),
        category: String(card.dataset.category || "").toLowerCase(),
        tags: tags.slice(0, LIMITS.tags),
        author: text(".post-author-sm span").slice(0, LIMITS.author),
        readTime: text(".card-info").slice(0, LIMITS.readTime),
        coverImage: /^images\/[A-Za-z0-9/_.-]+$/.test(cover) ? cover : "",
        contentHtml,
        date: String(card.dataset.date || ""),
      };
    });
    return siteArticles;
  }

  /** The site articles that are not in the panel yet. */
  function siteArticlesToImport() {
    const taken = new Set(appState.posts.map((p) => p.slug));
    return readSiteArticles().filter((a) =>
      a.title && a.slug && !taken.has(a.slug) &&
      CATEGORIES.includes(a.category) && /^\d{4}-\d{2}-\d{2}$/.test(a.date));
  }

  async function importSiteArticles() {
    if (appState.busy || !isOfficer()) return;

    setBusy(true);
    try {
      await refreshPosts();
      const articles = siteArticlesToImport();
      if (!articles.length) {
        toast("Nothing to import — every site article is already here.");
        return;
      }
      const ok = await askConfirm({
        title: `Import ${plural(articles.length, "site article", "site articles")}?`,
        text: "They are copied in as published posts and stay on the blog, shown newest first. From then on you edit them here.",
        okLabel: "Import",
        icon: "fa-file-import",
        calm: true,
      });
      if (!ok) return;

      const now = svc.nowIso();
      await svc.importPosts(cfg, articles.map((a) => ({
        ...a,
        status: "published",
        featured: false,
        seo: { title: "", description: "", keywords: [] },
        publishedAt: `${a.date}T00:00:00.000Z`,
        createdAt: now,
        updatedAt: now,
        createdByUid: appState.access.uid,
        updatedByUid: appState.access.uid,
      })));

      await refreshPosts();
      if (await publishList()) toast(`Imported ${plural(articles.length, "article", "articles")}.`);
    } catch (err) {
      toast(describeError(err), true);
    } finally {
      setBusy(false);
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §7  EDITORS (officers)
  // Other active members the officers let in to write drafts. The officers
  // themselves are not on the list: their Mora Connect role is what lets them in.
  // ───────────────────────────────────────────────────────────────────────────

  async function renderEditors() {
    const editors = await svc.listEditors(cfg);
    els.editorsList.innerHTML = editors.map((editor) => `
      <div class="row no-thumb">
        <div class="row-main">
          <h3>${esc(editor.name)}</h3>
          <p class="row-meta">${esc(editor.email)}</p>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-ghost btn-sm btn-delete" data-email="${esc(editor.email)}" data-name="${esc(editor.name)}">
            <i class="fas fa-user-minus"></i><span>Remove</span>
          </button>
        </div>
      </div>
    `).join("") || '<p class="empty"><i class="fas fa-users"></i><span>No editors added. Only the Secretary, President and Super Admin can sign in.</span></p>';
  }

  async function openEditors() {
    showSection("editors");
    try {
      await renderEditors();
    } catch (err) {
      toast(describeError(err), true);
    }
  }

  async function onEditorsListClick(event) {
    const btn = event.target.closest("button[data-email]");
    if (!btn) return;
    const email = btn.getAttribute("data-email");
    const ok = await askConfirm({
      title: `Remove ${btn.getAttribute("data-name") || email}?`,
      text: "They will no longer be able to sign in to the blog admin. Their posts stay.",
      okLabel: "Remove",
      icon: "fa-user-minus",
    });
    if (!ok) return;
    try {
      await svc.removeEditor(cfg, email);
      await renderEditors();
      toast("Editor removed.");
    } catch (err) {
      toast(describeError(err), true);
    }
  }

  async function addEditor(event) {
    event.preventDefault();
    const email = els.editorEmail.value.trim().toLowerCase();
    const name = els.editorName.value.trim();
    if (!email || !name) return;
    try {
      await svc.saveEditor(cfg, email, name);
      els.editorForm.reset();
      await renderEditors();
      toast("Editor added. They can sign in with their Mora Connect account.");
    } catch (err) {
      toast(describeError(err), true);
    }
  }


  // ───────────────────────────────────────────────────────────────────────────
  // §8  START-UP
  // ───────────────────────────────────────────────────────────────────────────

  async function initEditor() {
    appState.editor = await ClassicEditor.create($("postContentEditor"), {
      // Pictures inside the article and video embeds are left out: nothing here uploads them yet
      toolbar: ["heading", "|", "bold", "italic", "link", "bulletedList", "numberedList", "blockQuote", "insertTable", "|", "undo", "redo"],
      // The blog styles <h3> as an article's section heading (its title is the <h2>)
      heading: {
        options: [
          { model: "paragraph", title: "Paragraph", class: "ck-heading_paragraph" },
          { model: "heading2", view: "h3", title: "Heading", class: "ck-heading_heading2" },
          { model: "heading3", view: "h4", title: "Small heading", class: "ck-heading_heading3" },
        ],
      },
      placeholder: "Write the story here…",
    });
    appState.editor.model.document.on("change:data", () => {
      markDirty();
      renderPreview();
    });
  }

  function wireEvents() {
    // ── Sign in / out ──
    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = els.loginEmail.value.trim();
      const password = els.loginPassword.value;
      if (!email || !password) {
        showLoginError("Enter your email and password.");
        return;
      }

      showLoginError("");
      setLoginBusy(true);
      try {
        await svc.authSignIn(email, password);
        els.loginPassword.value = "";
        // The button stays busy until the panel — or a refusal — is on screen (see showView)
      } catch (err) {
        setLoginBusy(false);
        showLoginError(signInErrorMessage(err));
      }
    });

    els.togglePassword.addEventListener("click", () => {
      const show = els.loginPassword.type === "password";
      els.loginPassword.type = show ? "text" : "password";
      els.togglePassword.setAttribute("aria-label", show ? "Hide password" : "Show password");
      els.togglePassword.firstElementChild.className = `fas ${show ? "fa-eye-slash" : "fa-eye"}`;
    });

    els.logoutBtn.addEventListener("click", async () => {
      if (await okToLeaveForm()) svc.authSignOut();
    });

    // ── Side menu ──
    navItems.forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await okToLeaveForm())) return;
        appState.dirty = false;
        if (btn.dataset.section === "editors") {
          openEditors();
        } else {
          renderPosts();
          showSection("posts");
        }
      });
    });

    // ── Posts list ──
    els.newPostBtn.addEventListener("click", () => openEditor(null));
    els.importBtn.addEventListener("click", importSiteArticles);
    els.rebuildBtn.addEventListener("click", rebuildPublicList);
    els.postSearch.addEventListener("input", renderPosts);
    els.statusTabs.addEventListener("click", (event) => {
      const tab = event.target.closest(".tab");
      if (!tab) return;
      appState.statusFilter = tab.getAttribute("data-status");
      renderPosts();
    });
    els.postList.addEventListener("click", onPostListClick);
    // A cover that fails to load gives way to the plain placeholder
    els.postList.addEventListener("error", (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || !img.classList.contains("row-thumb")) return;
      const placeholder = document.createElement("div");
      placeholder.className = "row-thumb placeholder";
      placeholder.innerHTML = '<i class="fas fa-image"></i>';
      img.replaceWith(placeholder);
    }, true);

    // ── Form ──
    els.backBtn.addEventListener("click", closeEditor);
    els.cancelBtn.addEventListener("click", closeEditor);

    els.postTitle.addEventListener("input", () => {
      // The link name follows the title until the post has been saved once
      if (!appState.loadedPost) els.postSlug.value = slugify(els.postTitle.value);
    });

    els.postForm.addEventListener("input", () => {
      markDirty();
      renderPreview();
    });
    els.postForm.addEventListener("change", () => {
      markDirty();
      renderPreview();
    });
    els.postForm.addEventListener("submit", (e) => e.preventDefault());

    els.coverUpload.addEventListener("change", () => pickCover(els.coverUpload.files && els.coverUpload.files[0]));
    ["dragenter", "dragover"].forEach((type) => els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((type) => els.dropzone.addEventListener(type, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove("dragging");
    }));
    els.dropzone.addEventListener("drop", (e) => pickCover(e.dataTransfer.files[0]));
    els.removeCoverBtn.addEventListener("click", () => {
      appState.coverPath = "";
      appState.pickedCover = null;
      els.coverUpload.value = "";
      markDirty();
      renderCover();
      renderPreview();
    });
    els.previewImage.addEventListener("error", () => {
      els.previewImage.hidden = true;
      els.previewIcon.hidden = false;
    });

    els.saveBtn.addEventListener("click", () => savePost(null));
    els.reviewBtn.addEventListener("click", () => savePost("review"));
    els.publishBtn.addEventListener("click", () => savePost("published"));
    els.unpublishBtn.addEventListener("click", () => savePost("draft"));
    els.deleteBtn.addEventListener("click", () => deletePost(appState.loadedPost));

    // ── Editors ──
    els.editorsList.addEventListener("click", onEditorsListClick);
    els.editorForm.addEventListener("submit", addEditor);

    // Closing the tab with unsaved writing: the browser asks first
    window.addEventListener("beforeunload", (e) => {
      if (appState.section === "editor" && appState.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }

  async function main() {
    try {
      if (!hasFirebaseConfig()) {
        showView("login");
        showLoginError("Sign-in is not set up yet.");
        return;
      }

      fillCategories();
      svc.initFirebase(cfg);
      await initEditor();
      wireEvents();

      // Fires once at start-up (someone is already signed in, or nobody is) and at every sign-in / sign-out
      svc.onAuthChange(async (user) => {
        try {
          if (!user) {
            leaveAdmin();
            return;
          }
          await enterAdmin();
        } catch (err) {
          // Signed in, but the panel could not be loaded: back to the sign-in screen with the reason
          await refuse(describeError(err)).catch(() => leaveAdmin());
        }
      });
    } catch (err) {
      console.error(err);
      showView("login");
      showLoginError(describeError(err));
    }
  }

  main();
})();
