// ─────────────────────────────────────────────────────────────────────────────
// HOW TO USE THIS FILE
// These are the rules tests for the blog. Paste everything below into
// moraLeoPortal/tests/rules/rules.test.mjs, just above the line
// `await testEnv.cleanup();` at the bottom, then run:  npm run test:rules
// It is not a test file on its own — it uses the helpers defined at the top
// of that file (testEnv, check, fs, st, PNG, and the members admin@x.com =
// secretary, super@x.com = superAdmin, exadmin@x.com = deactivated secretary,
// active@x.com = ordinary member).
// ─────────────────────────────────────────────────────────────────────────────

// ── Blog (moraLeoBlog /admin) ────────────────────────────────────────────────
// The portal's admins (Secretary, President, Super Admin) run the blog. They
// can list other active members in blogEditors/{email} as editors, who write
// their own drafts but can't publish. fs('writer@x.com') has account id "writer".
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
  await db.doc('members/pres@x.com').set({ fullName: 'Pres', role: 'president', isActive: true, email: 'pres@x.com', profilePhoto: '' });
  for (const name of ['writer', 'writer2']) {
    await db.doc(`members/${name}@x.com`).set({ fullName: name, role: 'member', isActive: true, email: `${name}@x.com`, profilePhoto: '' });
  }
  await db.doc('members/leftclub@x.com').set({ fullName: 'Left', role: 'member', isActive: false, email: 'leftclub@x.com', profilePhoto: '' });
  await db.doc('blogEditors/writer@x.com').set({ name: 'Writer' });
  await db.doc('blogEditors/writer2@x.com').set({ name: 'Writer 2' });
  await db.doc('blogEditors/leftclub@x.com').set({ name: 'Left the club' });
  await db.doc('blogEditors/outsider@x.com').set({ name: 'Not a member' });
  await db.doc('blogPosts/pub').set(blogPost('writer', { ...live, slug: 'live-post' }));
  await db.doc('blogPosts/draftW').set(blogPost('writer', { slug: 'draft-w' }));
  await db.doc('blogPosts/draftW2').set(blogPost('writer2', { slug: 'draft-w2' }));
  await db.doc('blogPosts/rev').set(blogPost('writer', { slug: 'in-review', status: 'review' }));
  await db.doc('blogPosts/gone1').set(blogPost('writer', { slug: 'gone-1' }));
  await db.doc('blogPosts/gone2').set(blogPost('writer', { ...live, slug: 'gone-2' }));
  await db.doc('blogIndex/current').set({ posts: [{ id: 'pub', slug: 'live-post', title: 'Beach Clean-up' }], updatedAt: '2026-10-14T00:00:00.000Z' });
  await ctx.storage().ref('blog/pub/cover.webp').put(PNG, { contentType: 'image/webp' });
  await ctx.storage().ref('blog/pub/old.webp').put(PNG, { contentType: 'image/webp' });
  await ctx.storage().ref('blog/pub/old2.webp').put(PNG, { contentType: 'image/webp' });
});

console.log('Firestore — blog (what visitors can read)');
await check('visitor reads the published list',        'allow', () => fs(null).doc('blogIndex/current').get());
await check('visitor opens a published post',          'allow', () => fs(null).doc('blogPosts/pub').get());
await check('visitor opens a draft',                   'deny',  () => fs(null).doc('blogPosts/draftW').get());
await check('visitor opens a post in review',          'deny',  () => fs(null).doc('blogPosts/rev').get());
await check('visitor lists posts (even published)',    'deny',  () => fs(null).collection('blogPosts').where('status', '==', 'published').get());
await check('visitor reads the editor list',           'deny',  () => fs(null).collection('blogEditors').get());
await check('visitor reads one editor entry',          'deny',  () => fs(null).doc('blogEditors/writer@x.com').get());
await check('visitor writes a post',                   'deny',  () => fs(null).doc('blogPosts/x1').set(blogPost('nobody')));
await check('visitor rewrites the published list',     'deny',  () => fs(null).doc('blogIndex/current').set({ posts: [], updatedAt: 'x' }));
await check('ordinary member opens a draft',           'deny',  () => fs('active@x.com').doc('blogPosts/draftW').get());
await check('ordinary member lists posts',             'deny',  () => fs('active@x.com').collection('blogPosts').get());
await check('ordinary member writes a post',           'deny',  () => fs('active@x.com').doc('blogPosts/x1').set(blogPost('active')));
await check('stranger (self-signed-up) writes a post', 'deny',  () => fs('stranger@x.com').doc('blogPosts/x1').set(blogPost('stranger')));

console.log('Firestore — blog posts (Secretary, President, Super Admin)');
await check('secretary lists all posts, drafts too',   'allow', () => fs('admin@x.com').collection('blogPosts').get());
await check('president opens a draft',                 'allow', () => fs('pres@x.com').doc('blogPosts/draftW').get());
await check('super admin opens a post in review',      'allow', () => fs('super@x.com').doc('blogPosts/rev').get());
await check('secretary starts a draft',                'allow', () => fs('admin@x.com').doc('blogPosts/a1').set(blogPost('admin', { slug: 'a1' })));
await check('president creates a published post',      'allow', () => fs('pres@x.com').doc('blogPosts/a2').set(blogPost('pres', { ...live, slug: 'a2' })));
await check('super admin creates a featured post',     'allow', () => fs('super@x.com').doc('blogPosts/a3').set(blogPost('super', { ...live, slug: 'a3', featured: true })));
await check('secretary publishes an editor\'s draft',  'allow', () => fs('admin@x.com').doc('blogPosts/draftW2').update({ ...live, updatedByUid: 'admin' }));
await check('president edits a published post',        'allow', () => fs('pres@x.com').doc('blogPosts/pub').update({ title: 'Edited', updatedByUid: 'pres' }));
await check('super admin features a post',             'allow', () => fs('super@x.com').doc('blogPosts/pub').update({ featured: true, updatedByUid: 'super' }));
await check('secretary unpublishes a post',            'allow', () => fs('admin@x.com').doc('blogPosts/draftW2').update({ status: 'draft', updatedByUid: 'admin' }));
await check('secretary takes over a post\'s owner',    'deny',  () => fs('admin@x.com').doc('blogPosts/pub').update({ createdByUid: 'admin', updatedByUid: 'admin' }));
await check('secretary saves in someone else\'s name', 'deny',  () => fs('admin@x.com').doc('blogPosts/pub').update({ title: 'x', updatedByUid: 'pres' }));
await check('published post without a date',           'deny',  () => fs('admin@x.com').doc('blogPosts/x4').set(blogPost('admin', { status: 'published' })));
await check('secretary deletes a published post',      'allow', () => fs('admin@x.com').doc('blogPosts/gone2').delete());
await check('secretary rewrites the published list',   'allow', () => fs('admin@x.com').doc('blogIndex/current').set({ posts: [{ id: 'pub' }], updatedAt: '2026-10-14T01:00:00.000Z' }));
await check('published list under another name',       'deny',  () => fs('admin@x.com').doc('blogIndex/other').set({ posts: [], updatedAt: '2026-10-14T01:00:00.000Z' }));
await check('published list with an extra field',      'deny',  () => fs('admin@x.com').doc('blogIndex/current').set({ posts: [], updatedAt: 'x', note: 'hi' }));
await check('published list with 1001 posts',          'deny',  () => fs('admin@x.com').doc('blogIndex/current').set({ posts: Array.from({ length: 1001 }, (_, i) => ({ id: 'p' + i })), updatedAt: 'x' }));
await check('deactivated secretary lists posts',       'deny',  () => fs('exadmin@x.com').collection('blogPosts').get());
await check('deactivated secretary writes a post',     'deny',  () => fs('exadmin@x.com').doc('blogPosts/x1').set(blogPost('exadmin')));
await check('deactivated secretary rewrites the list', 'deny',  () => fs('exadmin@x.com').doc('blogIndex/current').set({ posts: [], updatedAt: 'x' }));

console.log('Firestore — blog posts (editors the admins listed)');
await check('editor lists all posts, drafts too',      'allow', () => fs('writer@x.com').collection('blogPosts').get());
await check('editor opens another editor\'s draft',    'allow', () => fs('writer@x.com').doc('blogPosts/draftW2').get());
await check('editor starts a draft',                   'allow', () => fs('writer@x.com').doc('blogPosts/n1').set(blogPost('writer', { slug: 'n1' })));
await check('editor starts a draft with a site image', 'allow', () => fs('writer@x.com').doc('blogPosts/n2').set(blogPost('writer', { slug: 'n2', coverImage: 'images/events/aloka-26.jpg' })));
await check('editor starts a draft with an upload',    'allow', () => fs('writer@x.com').doc('blogPosts/n3').set(blogPost('writer', { slug: 'n3', coverImage: 'blog/n3/cover-1.jpg' })));
await check('editor starts a draft in another name',   'deny',  () => fs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer2', { updatedByUid: 'writer' })));
await check('editor creates a published post',         'deny',  () => fs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer', live)));
await check('editor creates a featured draft',         'deny',  () => fs('writer@x.com').doc('blogPosts/x2').set(blogPost('writer', { featured: true })));
await check('editor edits own draft',                  'allow', () => fs('writer@x.com').doc('blogPosts/draftW').set(blogPost('writer', { slug: 'draft-w', title: 'Better title' })));
await check('editor sends own draft for review',       'allow', () => fs('writer@x.com').doc('blogPosts/draftW').update({ status: 'review' }));
await check('editor takes own post back to draft',     'allow', () => fs('writer@x.com').doc('blogPosts/rev').update({ status: 'draft' }));
await check('editor publishes own draft',              'deny',  () => fs('writer@x.com').doc('blogPosts/draftW').update(live));
await check('editor features own draft',               'deny',  () => fs('writer@x.com').doc('blogPosts/draftW').update({ featured: true }));
await check('editor edits another editor\'s draft',    'deny',  () => fs('writer2@x.com').doc('blogPosts/draftW').update({ title: 'Mine now', updatedByUid: 'writer2' }));
await check('editor edits own post once published',    'deny',  () => fs('writer@x.com').doc('blogPosts/pub').update({ title: 'Changed' }));
await check('editor unpublishes own post',             'deny',  () => fs('writer@x.com').doc('blogPosts/pub').update({ status: 'draft' }));
await check('editor gives own draft to someone else',  'deny',  () => fs('writer@x.com').doc('blogPosts/draftW').update({ createdByUid: 'writer2' }));
await check('editor changes the created date',         'deny',  () => fs('writer@x.com').doc('blogPosts/draftW').update({ createdAt: '2020-01-01T00:00:00.000Z' }));
await check('editor saves in another editor\'s name',  'deny',  () => fs('writer@x.com').doc('blogPosts/draftW').update({ updatedByUid: 'writer2' }));
await check('editor deletes another editor\'s draft',  'deny',  () => fs('writer2@x.com').doc('blogPosts/draftW').delete());
await check('editor deletes own published post',       'deny',  () => fs('writer@x.com').doc('blogPosts/pub').delete());
await check('editor deletes own draft',                'allow', () => fs('writer@x.com').doc('blogPosts/gone1').delete());
await check('editor rewrites the published list',      'deny',  () => fs('writer@x.com').doc('blogIndex/current').set({ posts: [], updatedAt: 'x' }));
await check('listed editor who left the club writes',  'deny',  () => fs('leftclub@x.com').doc('blogPosts/x3').set(blogPost('leftclub')));
await check('listed editor who left opens a draft',    'deny',  () => fs('leftclub@x.com').doc('blogPosts/draftW').get());
await check('listed editor who is not a member writes','deny',  () => fs('outsider@x.com').doc('blogPosts/x3').set(blogPost('outsider')));

console.log('Firestore — blog posts (what may be saved)');
const bad = (label, extra) => check(label, 'deny', () => fs('admin@x.com').doc('blogPosts/x4').set(blogPost('admin', extra)));
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

console.log('Firestore — blog editors list');
await check('editor reads own entry',                  'allow', () => fs('writer@x.com').doc('blogEditors/writer@x.com').get());
await check('editor reads another editor\'s entry',    'deny',  () => fs('writer@x.com').doc('blogEditors/writer2@x.com').get());
await check('editor reads the whole list',             'deny',  () => fs('writer@x.com').collection('blogEditors').get());
await check('ordinary member reads the list',          'deny',  () => fs('active@x.com').collection('blogEditors').get());
await check('stranger reads the list',                 'deny',  () => fs('stranger@x.com').collection('blogEditors').get());
await check('secretary reads the whole list',          'allow', () => fs('admin@x.com').collection('blogEditors').get());
await check('secretary adds an editor',                'allow', () => fs('admin@x.com').doc('blogEditors/new@x.com').set({ name: 'New' }));
await check('president adds an editor',                'allow', () => fs('pres@x.com').doc('blogEditors/new2@x.com').set({ name: 'New 2' }));
await check('secretary adds mixed-case email id',      'deny',  () => fs('admin@x.com').doc('blogEditors/New@X.com').set({ name: 'New' }));
await check('secretary adds an entry with no name',    'deny',  () => fs('admin@x.com').doc('blogEditors/new3@x.com').set({ name: '' }));
await check('secretary adds an extra field',           'deny',  () => fs('admin@x.com').doc('blogEditors/new3@x.com').set({ name: 'New', role: 'superAdmin' }));
await check('editor adds an editor',                   'deny',  () => fs('writer@x.com').doc('blogEditors/new4@x.com').set({ name: 'New' }));
await check('ordinary member adds self as editor',     'deny',  () => fs('active@x.com').doc('blogEditors/active@x.com').set({ name: 'Me' }));
await check('deactivated secretary adds an editor',    'deny',  () => fs('exadmin@x.com').doc('blogEditors/new4@x.com').set({ name: 'New' }));
await check('editor removes another editor',           'deny',  () => fs('writer@x.com').doc('blogEditors/writer2@x.com').delete());
await check('super admin removes an editor',           'allow', () => fs('super@x.com').doc('blogEditors/new@x.com').delete());
await check('editor reads a member\'s record',         'deny',  () => fs('writer@x.com').doc('members/victim@x.com').get());
await check('editor reads portal attendance',          'deny',  () => fs('writer@x.com').doc('attendance/a2').get());
await check('editor creates a portal event',           'deny',  () => fs('writer@x.com').collection('events').add({ title: 'x' }));

console.log('Storage — blog images');
await check('visitor views a blog image',              'allow', () => st(null).ref('blog/pub/cover.webp').getMetadata());
await check('visitor lists a post\'s images',          'deny',  () => st(null).ref('blog/pub').listAll());
await check('secretary uploads a JPEG photo',          'allow', () => st('admin@x.com').ref('blog/n3/cover-0.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor uploads a JPEG photo',             'allow', () => st('writer@x.com').ref('blog/n3/cover-1.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor uploads an SVG',                   'deny',  () => st('writer@x.com').ref('blog/n3/c.svg').put(PNG, { contentType: 'image/svg+xml' }));
await check('editor uploads a 4 MB photo',             'deny',  () => st('writer@x.com').ref('blog/n3/d.jpg').put(new Uint8Array(4 * 1024 * 1024), { contentType: 'image/jpeg' }));
await check('editor uploads outside a post folder',    'deny',  () => st('writer@x.com').ref('blog/loose.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor uploads a member profile photo',   'deny',  () => st('writer@x.com').ref('profiles/victim@x.com/photo').put(PNG, { contentType: 'image/jpeg' }));
await check('listed editor who left the club uploads', 'deny',  () => st('leftclub@x.com').ref('blog/n3/f.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('ordinary member uploads a blog image',    'deny',  () => st('active@x.com').ref('blog/n3/g.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('deactivated secretary uploads',           'deny',  () => st('exadmin@x.com').ref('blog/n3/h.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('visitor uploads a blog image',            'deny',  () => st(null).ref('blog/n3/i.jpg').put(PNG, { contentType: 'image/jpeg' }));
await check('editor deletes a blog image',             'deny',  () => st('writer@x.com').ref('blog/pub/old.webp').delete());
await check('secretary deletes a blog image',          'allow', () => st('admin@x.com').ref('blog/pub/old.webp').delete());
await check('deactivated secretary deletes an image',  'deny',  () => st('exadmin@x.com').ref('blog/pub/old2.webp').delete());
