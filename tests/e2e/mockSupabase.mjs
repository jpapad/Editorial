// Test-only: a fake signed-in session + canned Supabase REST/Auth responses,
// so authenticated screens can be driven without touching the real project.
import fs from 'node:fs';
const envFile = new URL('../../.env.local', import.meta.url);
const env = process.env.NEXT_PUBLIC_SUPABASE_URL ? `NEXT_PUBLIC_SUPABASE_URL=${process.env.NEXT_PUBLIC_SUPABASE_URL}` : fs.readFileSync(envFile, 'utf8');
const base = env.match(/NEXT_PUBLIC_SUPABASE_URL=(\S+)/)[1].replace(/\/$/, '');
const ref = new URL(base).hostname.split('.')[0];

export const TEST_USER = { id: '11111111-1111-4111-8111-111111111111', email: 'test.user@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

export async function mockSupabase(page, { books = [], isAdmin = false, comments = [], users = [], onWrite, signedIn = true, db: sharedDb } = {}) {
  const session = { access_token: 'test-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'test-refresh', user: TEST_USER };
  if (signedIn) await page.context().addCookies([{ name: `sb-${ref}-auth-token`, value: JSON.stringify(session), domain: 'localhost', path: '/' }]);
  const db = sharedDb ?? { books: structuredClone(books), comments: structuredClone(comments) };
  await page.route(`${base}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    // Storage: off unless a test turns it on with db.storage = {} (then uploads are kept there and served back).
    if (url.pathname.startsWith('/storage/v1/object/public/')) {
      const file = db.storage?.[url.pathname.replace('/storage/v1/object/public/', '')];
      return file ? route.fulfill({ status: 200, contentType: file.type, body: file.body, headers: { 'access-control-allow-origin': '*' } }) : json({ message: 'Object not found' }, 404);
    }
    if (url.pathname.startsWith('/storage/v1/')) {
      if (!db.storage) return json({ statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' }, 400);
      if (method === 'DELETE') { for (const name of JSON.parse(req.postData() || '{}').prefixes ?? []) delete db.storage[`${url.pathname.replace('/storage/v1/object/', '')}/${name}`]; return json([]); }
      const key = url.pathname.replace('/storage/v1/object/', '');
      if (db.storage[key]) return json({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }, 400);
      // supabase-js uploads a Blob as multipart form data: keep just the file part.
      let body = req.postDataBuffer();
      let type = req.headers()['content-type'] || 'application/octet-stream';
      const boundary = /boundary=(.+)$/.exec(type)?.[1];
      if (boundary) {
        const text = body.toString('latin1');
        const part = text.indexOf('filename=');
        const start = text.indexOf('\r\n\r\n', part) + 4;
        const end = text.indexOf(`\r\n--${boundary}`, start);
        type = /Content-Type: ([^\r\n]+)/i.exec(text.slice(part, start))?.[1] ?? 'application/octet-stream';
        body = body.subarray(start, end);
      }
      db.storage[key] = { type, body };
      onWrite?.('storage', key);
      return json({ Key: key, Id: crypto.randomUUID() });
    }
    // The media library (sql/08): absent unless a test provides db.media.
    if (url.pathname === '/rest/v1/user_media') {
      if (!db.media) return json({ message: 'relation "public.user_media" does not exist' }, 404);
      const mediaId = url.searchParams.get('id')?.replace('eq.', '');
      if (method === 'GET') return json([...db.media].reverse());
      if (method === 'POST') {
        const row = JSON.parse(req.postData() || '{}');
        const existing = db.media.find((m) => m.path === row.path);
        // on conflict do nothing: a duplicate returns no row.
        if (existing) return json(single ? null : [], single ? 200 : 201);
        const made = { id: crypto.randomUUID(), user_id: TEST_USER.id, created_at: new Date().toISOString(), ...row };
        db.media.push(made); onWrite?.('media', made);
        return json(single ? made : [made], 201);
      }
      if (method === 'DELETE') { db.media = db.media.filter((m) => m.id !== mediaId); return json([]); }
    }
    // The account library (sql/06): absent unless a test provides db.stamps / db.versions.
    if (url.pathname === '/rest/v1/user_stamps' || url.pathname === '/rest/v1/book_versions') {
      const name = url.pathname.endsWith('user_stamps') ? 'stamps' : 'versions';
      if (!db[name]) return json({ message: `relation "public.${name}" does not exist` }, 404);
      const idFilter = url.searchParams.get('id')?.replace('eq.', '');
      const bookFilter = url.searchParams.get('book_id')?.replace('eq.', '');
      if (method === 'GET') {
        const rows = db[name].filter((r) => (!idFilter || r.id === idFilter) && (!bookFilter || r.book_id === bookFilter)).reverse();
        return json(single ? rows[0] ?? null : rows);
      }
      if (method === 'POST') {
        const body = JSON.parse(req.postData() || '{}');
        for (const row of Array.isArray(body) ? body : [body]) {
          const i = db[name].findIndex((r) => r.id === row.id);
          if (i >= 0) db[name][i] = { ...db[name][i], ...row }; else db[name].push({ created_at: new Date().toISOString(), ...row });
        }
        onWrite?.(name, body);
        return json([], 201);
      }
      if (method === 'DELETE') { db[name] = db[name].filter((r) => r.id !== idFilter); return json([]); }
    }
    if (url.pathname.startsWith('/auth/v1/user')) return json(TEST_USER);
    if (url.pathname.startsWith('/auth/v1/')) return json({});
    if (url.pathname === '/rest/v1/rpc/is_admin') return json(isAdmin);
    if (url.pathname === '/rest/v1/rpc/admin_list_users') return json(users);
    if (url.pathname === '/rest/v1/rpc/admin_stats') return db.stats ? json(db.stats) : json({ message: 'Could not find the function public.admin_stats' }, 404);
    if (url.pathname === '/rest/v1/rpc/my_ai_usage') return db.usage ? json(db.usage) : json({ message: 'Could not find the function' }, 404);
    if (url.pathname === '/rest/v1/rpc/admin_set_ai_limit') { const b = JSON.parse(req.postData()); const u = users.find((x) => x.id === b.target_user); if (u) u.ai_limit = b.new_limit; onWrite?.('ai_limit', b); return json(null); }
    if (url.pathname === '/rest/v1/rpc/get_shared_book') {
      const token = JSON.parse(req.postData() || '{}').share_token;
      const s = (db.shares || []).find((x) => x.token === token && !x.revoked_at);
      const book = s && db.books.find((bk) => bk.id === s.book_id);
      return json(book ? { title: book.title, trim_size: book.trim_size, bleed: book.bleed, pages: book.pages.filter((pg) => !pg.isBlankBack).map((pg) => { const rest = { ...pg }; delete rest.fillDataUrl; delete rest.completedAt; delete rest.thumbnailDataUrl; return rest; }) } : null);
    }
    if (db.kids && url.pathname.startsWith('/rest/v1/rpc/kid_')) return kidsRoute(db.kids, url, method, req, json, single, onWrite);
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
    const table = url.pathname.replace('/rest/v1/', '');
    const idEq = url.searchParams.get('id')?.replace('eq.', '');
    if (table === 'books') {
      if (method === 'GET') {
        const rows = idEq ? db.books.filter((b) => b.id === idEq) : db.books;
        return json(single ? rows[0] ?? null : rows, single && !rows[0] ? 406 : 200);
      }
      if (method === 'POST' || method === 'PATCH') {
        const body = JSON.parse(req.postData() || '{}');
        const row = Array.isArray(body) ? body[0] : body;
        // insert() without an id: the database would assign one.
        if (method === 'POST' && !row.id) Object.assign(row, { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        const i = db.books.findIndex((b) => b.id === row.id);
        if (i >= 0) db.books[i] = { ...db.books[i], ...row }; else db.books.push(row);
        onWrite?.('books', row);
        return json(single ? row : [row], 201);
      }
    }
    if (table === 'books' && method === 'DELETE') { db.books = db.books.filter((b) => b.id !== idEq); onWrite?.('books_delete', idEq); return json([]); }
    // Classes & families (sql/10): in-memory tables plus the kid_* functions, when a test sets db.kids = {}.
    if (db.kids && (table.startsWith('kid_') || url.pathname.startsWith('/rest/v1/rpc/kid_'))) return kidsRoute(db.kids, url, method, req, json, single, onWrite);
    // Billing (sql/09): the signed-in user's own row, if a test sets db.subscription.
    if (table === 'subscriptions') return json(single ? db.subscription ?? null : db.subscription ? [db.subscription] : []);
    if (table === 'book_shares') {
      db.shares ??= [];
      if (method === 'GET') return json(db.shares.filter((s) => !s.revoked_at));
      if (method === 'POST') { const row = { token: crypto.randomUUID(), created_by: TEST_USER.id, created_at: new Date().toISOString(), revoked_at: null, ...JSON.parse(req.postData()) }; db.shares.push(row); return json(single ? row : [row], 201); }
      if (method === 'PATCH') { const tok = url.searchParams.get('token')?.replace('eq.', ''); const body = JSON.parse(req.postData()); db.shares = db.shares.map((s) => (s.token === tok ? { ...s, ...body } : s)); return json([]); }
    }
    if (table === 'book_templates') {
      if (!db.templates) return json({ message: 'relation "public.book_templates" does not exist' }, 404);
      if (method === 'GET') {
        const rows = idEq ? db.templates.filter((r) => r.id === idEq) : [...db.templates].reverse();
        return json(single ? rows[0] ?? null : rows);
      }
      if (method === 'POST') { const row = { id: crypto.randomUUID(), author_id: TEST_USER.id, created_at: new Date().toISOString(), ...JSON.parse(req.postData()) }; db.templates.push(row); onWrite?.('book_templates', row); return json(single ? row : [row], 201); }
      if (method === 'DELETE') { db.templates = db.templates.filter((r) => r.id !== idEq); onWrite?.('book_templates_delete', idEq); return json([]); }
    }
    if (table === 'page_comments') {
      if (method === 'GET') return json(db.comments);
      if (method === 'POST') {
        const row = { id: crypto.randomUUID(), author_id: TEST_USER.id, author_email: TEST_USER.email, resolved: false, created_at: new Date().toISOString(), ...JSON.parse(req.postData()) };
        db.comments.push(row); onWrite?.('page_comments', row);
        return json(single ? row : [row], 201);
      }
      return json([]);
    }
    return json([]);
  });
  return db;
}

export function bookRow(overrides = {}) {
  return { id: '22222222-2222-4222-8222-222222222222', user_id: TEST_USER.id, title: 'Test Book', status: 'draft', collection: null, trim_size: '8.5x11', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', bleed: false, paper: 'white', cover: null, pages: [], ...overrides };
}

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** sql/10_kid_groups.sql in memory: just enough PostgREST filtering for kidGroups.ts. */
function kidsRoute(k, url, method, req, json, single, onWrite) {
  k.groups ??= []; k.members ??= []; k.groupBooks ??= []; k.work ??= [];
  const body = () => JSON.parse(req.postData() || '{}');
  const filters = [...url.searchParams].filter(([key]) => !['select', 'order', 'on_conflict', 'columns'].includes(key));
  const match = (row) => filters.every(([key, v]) => v.startsWith('eq.') ? String(row[key]) === v.slice(3) : v.startsWith('in.(') ? v.slice(4, -1).split(',').map((x) => x.replace(/"/g, '')).includes(String(row[key])) : v.startsWith('is.') ? row[key] === null : true);
  const rpc = url.pathname.replace('/rest/v1/rpc/', '');
  const table = url.pathname.replace('/rest/v1/', '');
  const books = () => k.books ?? [];
  const byToken = (token) => k.members.find((m) => m.token === token);
  const cleanPages = (b) => b.pages.filter((p) => !p.isBlankBack).map((p) => { const r = { ...p }; delete r.fillDataUrl; delete r.completedAt; delete r.thumbnailDataUrl; return r; });
  if (rpc === 'kid_group_lookup') {
    const g = k.groups.find((x) => x.code === body().group_code.toUpperCase());
    return json(g ? { name: g.name, kind: g.kind, members: k.members.filter((m) => m.group_id === g.id).map(({ id, name, avatar }) => ({ id, name, avatar })) } : null);
  }
  if (rpc === 'kid_login') {
    const b = body(); const g = k.groups.find((x) => x.code === b.group_code.toUpperCase());
    const m = g && k.members.find((x) => x.id === b.member && x.group_id === g.id && x.pin.join() === b.picture_pin.join());
    return json(m ? m.token : null);
  }
  if (rpc === 'kid_home') {
    const m = byToken(body().kid_token); if (!m) return json(null);
    const g = k.groups.find((x) => x.id === m.group_id);
    const mine = k.work.filter((w) => w.member_id === m.id);
    return json({ name: m.name, avatar: m.avatar, group: g.name,
      books: k.groupBooks.filter((gb) => gb.group_id === g.id).map((gb) => books().find((b) => b.id === gb.book_id)).filter(Boolean).map((b) => ({ id: b.id, title: b.title, pages: cleanPages(b).length, done: mine.filter((w) => w.book_id === b.id && w.completed_at).length, cover: mine.find((w) => w.book_id === b.id && w.thumb)?.thumb ?? null })),
      stickers: mine.filter((w) => w.sticker !== null && w.sticker !== undefined).map((w) => w.sticker), notes: mine.filter((w) => w.comment).map((w) => ({ book_id: w.book_id, page_id: w.page_id, comment: w.comment })) });
  }
  if (rpc === 'kid_book') {
    const b = body(); const m = byToken(b.kid_token);
    const ok = m && k.groupBooks.some((gb) => gb.group_id === m.group_id && gb.book_id === b.book);
    const book = ok && books().find((x) => x.id === b.book);
    if (!book) return json(null);
    const work = Object.fromEntries(k.work.filter((w) => w.member_id === m.id && w.book_id === book.id).map((w) => [w.page_id, { fill: w.fill, thumb: w.thumb, completed_at: w.completed_at, sticker: w.sticker ?? null, comment: w.comment ?? null }]));
    return json({ title: book.title, trim_size: book.trim_size, bleed: book.bleed ?? false, pages: cleanPages(book), work });
  }
  if (rpc === 'kid_save') {
    const b = body(); const m = byToken(b.kid_token);
    if (!m || !k.groupBooks.some((gb) => gb.group_id === m.group_id && gb.book_id === b.book)) return json(false);
    let w = k.work.find((x) => x.member_id === m.id && x.book_id === b.book && x.page_id === b.page);
    if (!w) { w = { member_id: m.id, book_id: b.book, page_id: b.page, fill: null, thumb: null, completed_at: null, sticker: null, comment: null }; k.work.push(w); }
    w.fill = b.page_fill ?? w.fill; w.thumb = b.page_thumb ?? w.thumb; w.completed_at = w.completed_at ?? (b.done ? new Date().toISOString() : null); w.updated_at = new Date().toISOString();
    onWrite?.('kid_save', b);
    return json(true);
  }
  const store = { kid_groups: 'groups', kid_members: 'members', kid_group_books: 'groupBooks', kid_work: 'work' }[table];
  if (!store) return json({ message: `unknown ${table}` }, 404);
  if (method === 'GET') { const rows = k[store].filter(match); return json(single ? rows[0] ?? null : rows); }
  if (method === 'POST') {
    const rows = [body()].flat().map((r) => store === 'groups' ? { id: crypto.randomUUID(), kind: 'class', code: Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * 31)]).join(''), created_at: new Date().toISOString(), ...r }
      : store === 'members' ? { id: crypto.randomUUID(), avatar: 0, pin: [Math.floor(Math.random() * 9), Math.floor(Math.random() * 9)], token: crypto.randomUUID(), created_at: new Date().toISOString(), ...r } : { ...r });
    for (const r of rows) if (!(store === 'groupBooks' && k.groupBooks.some((x) => x.group_id === r.group_id && x.book_id === r.book_id))) k[store].push(r);
    onWrite?.(table, rows);
    return json(single ? rows[0] : rows, 201);
  }
  if (method === 'PATCH') { const changes = body(); const rows = k[store].filter(match); rows.forEach((r) => Object.assign(r, changes)); onWrite?.(table, changes); return json(single ? rows[0] ?? null : rows); }
  if (method === 'DELETE') {
    const gone = k[store].filter(match); k[store] = k[store].filter((r) => !match(r));
    if (store === 'groups') for (const g of gone) k.members = k.members.filter((m) => m.group_id !== g.id);
    if (store === 'members') for (const m of gone) k.work = k.work.filter((w) => w.member_id !== m.id);
    return json([]);
  }
  return json([]);
}
