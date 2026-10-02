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
