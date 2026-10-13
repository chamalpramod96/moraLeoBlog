// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE THIS FILE
// These are the rules tests for the blog. Paste everything below into
// moraLeoPortal/tests/rules/rules.test.mjs, just above the line
// `await testEnv.cleanup();` at the bottom, then run:  npm run test:rules
// It is not a test file on its own — it uses the helpers defined at the top
// of that file (testEnv, check, fs, st, PNG).
// ─────────────────────────────────────────────────────────────────────────────

// ── Blog (moraLeoBlog /admin) ────────────────────────────────────────────────
// Blog editors are their own list (blogEditors/{email}); they must also be
// active members with a verified email — `blog(email)` signs in with
// email_verified: true, and its account id is "<name>-b".
const blog = (email) => testEnv.authenticatedContext(email.split('@')[0] + '-b', { email, email_verified: true });
const bfs  = (email) => blog(email).firestore();
const bst  = (email) => blog(email).storage();

const blogPost = (uid, extra = {}) => ({
  title: 'Beach Clean-up', slug: 'beach-clean-up', excerpt: 'We cleaned the beach', category: 'service',
  tags: ['Service'], author: 'Writer', readTime: '3 min read', status: 'draft', featured: false,
  coverImage: '', contentHtml: '<p>Hello</p>', seo: { title: '', description: '', keywords: [] },
  date: '', publishedAt: '', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z',
  createdByUid: uid, updatedByUid: uid, ...extra,
});
const live = { status: 'published', date: '2026-10-14', publishedAt: '2026-10-14T00:00:00.000Z' };

await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const name of ['chief', 'chief2', 'writer', 'writer2']) {
    await db.doc(`members/${name}@x.com`).set({ fullName: name, role: 'member', isActive: true, email: `${name}@x.com`, profilePhoto: '' });
  }
  await db.doc('members/leftclub@x.com').set({ fullName: 'Left', role: 'member', isActive: false, email: 'leftclub@x.com', profilePhoto: '' });
  await db.doc('blogEditors/chief@x.com').set({ role: 'chiefEditor', name: 'Chief' });
  await db.doc('blogEditors/chief2@x.com').set({ role: 'chiefEditor', name: 'Chief 2' });
  await db.doc('blogEditors/writer@x.com').set({ role: 'editor', name: 'Writer' });
  await db.doc('blogEditors/writer2@x.com').set({ role: 'editor', name: 'Writer 2' });
  await db.doc('blogEditors/leftclub@x.com').set({ role: 'editor', name: 'Left the club' });
  await db.doc('blogEditors/outsider@x.com').set({ role: 'editor', name: 'Not a member' });
  await db.doc('blogPosts/pub').set(blogPost('writer-b', { ...live, slug: 'live-post' }));
  await db.doc('blogPosts/draftW').set(blogPost('writer-b', { slug: 'draft-w' }));
  await db.doc('blogPosts/draftW2').set(blogPost('writer2-b', { slug: 'draft-w2' }));
  await db.doc('blogPosts/rev').set(blogPost('writer-b', { slug: 'in-review', status: 'review' }));
  await db.doc('blogPosts/gone1').set(blogPost('writer-b', { slug: 'gone-1' }));
  await db.doc('blogPosts/gone2').set(blogPost('writer-b', { ...live, slug: 'gone-2' }));
  await db.doc('blogIndex/current').set({ posts: [{ id: 'pub', slug: 'live-post', title: 'Beach Clean-up' }], updatedAt: '2026-10-14T00:00:00.000Z' });
  await ctx.storage().ref('blog/pub/cover.webp').put(PNG, { contentType: 'image/webp' });
  await ctx.storage().ref('blog/pub/old.webp').put(PNG, { contentType: 'image/webp' });
});

console.log('Firestore — blog (what visitors can read)');
await check('visitor reads the published list',        'allow', () => fs(null).doc('blogIndex/current').get());
await check('visitor opens a published post',          'allow', () => fs(null).doc('blogPosts/pub').get());
await check('visitor opens a draft',                   'deny',  () => fs(null).doc('blogPosts/draftW').get());
await check('visitor opens a post in review',          'deny',  () => fs(null).doc('blogPosts/rev').get());
await check('visitor lists posts (even published)',    'deny',  () => fs(null).collection('blogPosts').where('status', '==', 'published').get());
await check('visitor reads the editor list',           'deny',  () => fs(null).collection('blogEditors').get());
await check('visitor reads one editor entry',          'deny',  () => fs(null).doc('blogEditors/chief@x.com').get());
await check('visitor writes a post',                   'deny',  () => fs(null).doc('blogPosts/x1').set(blogPost('nobody')));
await check('visitor rewrites the published list',     'deny',  () => fs(null).doc('blogIndex/current').set({ posts: [], updatedAt: 'x' }));
await check('member (not an editor) opens a draft',    'deny',  () => bfs('active@x.com').doc('blogPosts/draftW').get());
await check('member (not an editor) writes a post',    'deny',  () => bfs('active@x.com').doc('blogPosts/x1').set(blogPost('active-b')));
await check('portal secretary opens a draft',          'deny',  () => bfs('admin@x.com').doc('blogPosts/draftW').get());
await check('portal secretary writes a post',          'deny',  () => bfs('admin@x.com').doc('blogPosts/x1').set(blogPost('admin-b')));
await check('portal super admin writes a post',        'deny',  () => bfs('super@x.com').doc('blogPosts/x1').set(blogPost('super-b')));

console.log('Firestore — blog posts (editors)');
await check('editor lists all posts, drafts too',      'allow', () => bfs('writer@x.com').collection('blogPosts').get());
await check('editor opens another editor\'s draft',    'allow', () => bfs('writer@x.com').doc('blogPosts/draftW2').get());
await check('editor starts a draft',                   'allow', () => bfs('writer@x.com').doc('blogPosts/n1').set(blogPost('writer-b', { slug: 'n1' })));
await check('editor starts a draft with a site image', 'allow', () => bfs('writer@x.com').doc('blogPosts/n2').set(blogPost('writer-b', { slug: 'n2', coverImage: 'images/events/aloka-26.jpg' })));
await check('editor starts a draft with an upload',    'allow', () => bfs('writer@x.com').doc('blogPosts/n3').set(blogPost('writer-b', { slug: 'n3', coverImage: 'blog/n3/cover-1.jpg' })));
await check('editor starts a draft in another name',   'deny',  () => bfs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer2-b', { updatedByUid: 'writer-b' })));
await check('editor creates a published post',         'deny',  () => bfs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer-b', live)));
await check('editor creates a featured draft',         'deny',  () => bfs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer-b', { featured: true })));
await check('editor edits own draft',                  'allow', () => bfs('writer@x.com').doc('blogPosts/draftW').set(blogPost('writer-b', { slug: 'draft-w', title: 'Better title' })));
await check('editor sends own draft for review',       'allow', () => bfs('writer@x.com').doc('blogPosts/draftW').update({ status: 'review' }));
await check('editor takes own post back to draft',     'allow', () => bfs('writer@x.com').doc('blogPosts/rev').update({ status: 'draft' }));
await check('editor publishes own draft',              'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW').update(live));
await check('editor features own draft',               'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW').update({ featured: true }));
await check('editor edits another editor\'s draft',    'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW2').update({ title: 'Mine now', updatedByUid: 'writer-b' }));
await check('editor edits own post once published',    'deny',  () => bfs('writer@x.com').doc('blogPosts/pub').update({ title: 'Changed' }));
await check('editor unpublishes own post',             'deny',  () => bfs('writer@x.com').doc('blogPosts/pub').update({ status: 'draft' }));
await check('editor gives own draft to someone else',  'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW').update({ createdByUid: 'writer2-b' }));
await check('editor changes the created date',         'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW').update({ createdAt: '2020-01-01T00:00:00.000Z' }));
await check('editor saves in another editor\'s name',  'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW').update({ updatedByUid: 'writer2-b' }));
await check('editor deletes another editor\'s draft',  'deny',  () => bfs('writer@x.com').doc('blogPosts/draftW2').delete());
await check('editor deletes own published post',       'deny',  () => bfs('writer@x.com').doc('blogPosts/pub').delete());
await check('editor deletes own draft',                'allow', () => bfs('writer@x.com').doc('blogPosts/gone1').delete());
await check('editor rewrites the published list',      'deny',  () => bfs('writer@x.com').doc('blogIndex/current').set({ posts: [], updatedAt: 'x' }));
await check('editor with unverified email writes',     'deny',  () => fs('writer@x.com').doc('blogPosts/x3').set(blogPost('writer')));
await check('editor with unverified email lists',      'deny',  () => fs('writer@x.com').collection('blogPosts').get());
await check('editor who left the club writes',         'deny',  () => bfs('leftclub@x.com').doc('blogPosts/x3').set(blogPost('leftclub-b')));
await check('editor who left the club opens a draft',  'deny',  () => bfs('leftclub@x.com').doc('blogPosts/draftW').get());
await check('listed editor who is not a member writes','deny',  () => bfs('outsider@x.com').doc('blogPosts/x3').set(blogPost('outsider-b')));

console.log('Firestore — blog posts (what may be saved)');
const bad = (label, extra) => check(label, 'deny', () => bfs('writer@x.com').doc('blogPosts/x4').set(blogPost('writer-b', extra)));
await bad('post with an empty title',                  { title: '' });
await bad('post with a slug with spaces',              { slug: 'Beach Clean Up' });
await bad('post with a slug ending in a dash',         { slug: 'beach-' });
await bad('post with an unknown status',               { status: 'live' });
await bad('post with an outside cover image',          { coverImage: 'https://evil.example/a.png' });
await bad('post with a cover from another folder',     { coverImage: 'profiles/active@x.com/photo' });
await bad('post with an extra field',                  { isAdmin: true });
await bad('post with a date that is not a date',       { date: 'yesterday' });
await bad('post with tags as text',                    { tags: 'Service' });
await bad('post with 16 tags',                         { tags: Array.from({ length: 16 }, (_, i) => 'tag' + i) });
await bad('post with a huge article',                  { contentHtml: 'x'.repeat(300001) });
await bad('post with a category with spaces',          { category: 'club news' });
await check('published post without a date',           'deny',  () => bfs('chief@x.com').doc('blogPosts/x4').set(blogPost('chief-b', { status: 'published' })));

console.log('Firestore — blog posts (chief editor)');
await check('chief editor publishes a draft',          'allow', () => bfs('chief@x.com').doc('blogPosts/draftW2').update({ ...live, updatedByUid: 'chief-b' }));
await check('chief editor edits a published post',     'allow', () => bfs('chief@x.com').doc('blogPosts/pub').update({ title: 'Edited', updatedByUid: 'chief-b' }));
await check('chief editor features a post',            'allow', () => bfs('chief@x.com').doc('blogPosts/pub').update({ featured: true, updatedByUid: 'chief-b' }));
await check('chief editor unpublishes a post',         'allow', () => bfs('chief@x.com').doc('blogPosts/draftW2').update({ status: 'draft', updatedByUid: 'chief-b' }));
await check('chief editor creates a published post',   'allow', () => bfs('chief@x.com').doc('blogPosts/n4').set(blogPost('chief-b', { ...live, slug: 'n4' })));
await check('chief editor takes over a post\'s owner', 'deny',  () => bfs('chief@x.com').doc('blogPosts/pub').update({ createdByUid: 'chief-b', updatedByUid: 'chief-b' }));
await check('chief editor deletes a published post',   'allow', () => bfs('chief@x.com').doc('blogPosts/gone2').delete());
await check('chief editor rewrites the published list','allow', () => bfs('chief@x.com').doc('blogIndex/current').set({ posts: [{ id: 'pub' }], updatedAt: '2026-10-14T01:00:00.000Z' }));
await check('published list under another name',       'deny',  () => bfs('chief@x.com').doc('blogIndex/other').set({ posts: [], updatedAt: '2026-10-14T01:00:00.000Z' }));
await check('published list with an extra field',      'deny',  () => bfs('chief@x.com').doc('blogIndex/current').set({ posts: [], updatedAt: 'x', note: 'hi' }));
await check('published list with 1001 posts',          'deny',  () => bfs('chief@x.com').doc('blogIndex/current').set({ posts: Array.from({ length: 1001 }, (_, i) => ({ id: 'p' + i })), updatedAt: 'x' }));

console.log('Firestore — blog editors list');
await check('editor reads own entry (unverified)',     'allow', () => fs('writer@x.com').doc('blogEditors/writer@x.com').get());
await check('editor reads another editor\'s entry',    'deny',  () => bfs('writer@x.com').doc('blogEditors/chief@x.com').get());
await check('editor reads the whole list',             'deny',  () => bfs('writer@x.com').collection('blogEditors').get());
await check('stranger reads the list',                 'deny',  () => bfs('stranger@x.com').collection('blogEditors').get());
await check('chief editor reads the whole list',       'allow', () => bfs('chief@x.com').collection('blogEditors').get());
await check('chief editor adds an editor',             'allow', () => bfs('chief@x.com').doc('blogEditors/new@x.com').set({ role: 'editor', name: 'New' }));
await check('chief editor adds another chief editor',  'allow', () => bfs('chief@x.com').doc('blogEditors/new2@x.com').set({ role: 'chiefEditor', name: 'New 2' }));
await check('chief editor adds mixed-case email id',   'deny',  () => bfs('chief@x.com').doc('blogEditors/New@X.com').set({ role: 'editor', name: 'New' }));
await check('chief editor adds an unknown role',       'deny',  () => bfs('chief@x.com').doc('blogEditors/new3@x.com').set({ role: 'owner', name: 'New' }));
await check('chief editor adds an entry with no name', 'deny',  () => bfs('chief@x.com').doc('blogEditors/new3@x.com').set({ role: 'editor', name: '' }));
await check('chief editor adds an extra field',        'deny',  () => bfs('chief@x.com').doc('blogEditors/new3@x.com').set({ role: 'editor', name: 'New', isAdmin: true }));
await check('editor adds an editor',                   'deny',  () => bfs('writer@x.com').doc('blogEditors/new4@x.com').set({ role: 'editor', name: 'New' }));
await check('editor promotes self to chief editor',    'deny',  () => bfs('writer@x.com').doc('blogEditors/writer@x.com').update({ role: 'chiefEditor' }));
await check('unverified chief editor adds an editor',  'deny',  () => fs('chief@x.com').doc('blogEditors/new4@x.com').set({ role: 'editor', name: 'New' }));
await check('portal super admin adds a blog editor',   'deny',  () => bfs('super@x.com').doc('blogEditors/new4@x.com').set({ role: 'editor', name: 'New' }));
await check('portal secretary reads the editor list',  'deny',  () => bfs('admin@x.com').collection('blogEditors').get());
await check('chief editor demotes self',               'deny',  () => bfs('chief@x.com').doc('blogEditors/chief@x.com').update({ role: 'editor' }));
await check('chief editor renames self',               'allow', () => bfs('chief@x.com').doc('blogEditors/chief@x.com').update({ name: 'Chief Editor' }));
await check('chief editor removes self',               'deny',  () => bfs('chief@x.com').doc('blogEditors/chief@x.com').delete());
await check('chief editor demotes another chief',      'allow', () => bfs('chief@x.com').doc('blogEditors/chief2@x.com').update({ role: 'editor' }));
await check('demoted chief editor adds an editor',     'deny',  () => bfs('chief2@x.com').doc('blogEditors/new4@x.com').set({ role: 'editor', name: 'New' }));
await check('chief editor removes an editor',          'allow', () => bfs('chief@x.com').doc('blogEditors/new@x.com').delete());
await check('blog editor reads a member\'s record',    'deny',  () => bfs('chief@x.com').doc('members/victim@x.com').get());
await check('blog editor reads portal attendance',     'deny',  () => bfs('chief@x.com').doc('attendance/a2').get());
await check('blog editor creates a portal event',      'deny',  () => bfs('chief@x.com').collection('events').add({ title: 'x' }));

console.log('Storage — blog images');
await check('visitor views a blog image',              'allow', () => st(null).ref('blog/pub/cover.webp').getMetadata());
await check('visitor lists a post\'s images',          'deny',  () => st(null).ref('blog/pub').listAll());
await check('editor uploads a JPEG photo',             'allow', () => bst('writer@x.com').ref('blog/n3/cover-1.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor uploads an SVG',                   'deny',  () => bst('writer@x.com').ref('blog/n3/c.svg').put(PNG, { contentType: 'image/svg+xml' }));
await check('editor uploads a 4 MB photo',             'deny',  () => bst('writer@x.com').ref('blog/n3/d.jpg').put(new Uint8Array(4 * 1024 * 1024), { contentType: 'image/jpeg' }));
await check('editor uploads outside a post folder',    'deny',  () => bst('writer@x.com').ref('blog/loose.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor uploads a member profile photo',   'deny',  () => bst('writer@x.com').ref('profiles/victim@x.com/photo').put(PNG, { contentType: 'image/jpeg' }));
await check('editor with unverified email uploads',    'deny',  () => st('writer@x.com').ref('blog/n3/e.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor who left the club uploads',        'deny',  () => bst('leftclub@x.com').ref('blog/n3/f.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('member (not an editor) uploads',          'deny',  () => bst('active@x.com').ref('blog/n3/g.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('portal secretary uploads a blog image',   'deny',  () => bst('admin@x.com').ref('blog/n3/h.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('visitor uploads a blog image',            'deny',  () => st(null).ref('blog/n3/i.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor deletes a blog image',             'deny',  () => bst('writer@x.com').ref('blog/pub/old.webp').delete());
await check('chief editor deletes a blog image',       'allow', () => bst('chief@x.com').ref('blog/pub/old.webp').delete());
