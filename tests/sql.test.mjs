// Runs sql/00_ALL.sql twice on PGlite (real Postgres, in-process) with a
// minimal stand-in for Supabase's auth schema, then exercises the RLS
// policies and functions as different users. Catches SQL that won't run
// or can't be re-run before it reaches the Supabase SQL Editor.
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";

let failures = 0;
const check = (cond, name, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures++;
};

const db = new PGlite();
await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, created_at timestamptz default now(), last_sign_in_at timestamptz, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to authenticated, anon;
`);

const all = fs.readFileSync(new URL("../sql/00_ALL.sql", import.meta.url), "utf8");
for (const run of [1, 2]) {
  try {
    await db.exec(all);
    check(true, `00_ALL.sql runs (${run === 1 ? "fresh database" : "again, on top of itself"})`);
  } catch (e) {
    check(false, `00_ALL.sql run ${run}`, `${e.message}${e.position ? ` (line ${all.slice(0, e.position).split("\n").length})` : ""}`);
    process.exit(1);
  }
}

const admin = "11111111-1111-4111-8111-111111111111";
const alice = "22222222-2222-4222-8222-222222222222";
const bob = "33333333-3333-4333-8333-333333333333";
await db.exec(`
  insert into auth.users (id, email) values ('${admin}', 'admin@x.gr'), ('${alice}', 'alice@x.gr'), ('${bob}', 'bob@x.gr');
  insert into public.app_admins values ('${admin}');
  grant select, insert, update, delete on public.books to authenticated;
`);
async function as(uid, sql) {
  await db.exec(uid ? `set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);` : `set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return (await db.query(sql)).rows;
  } finally {
    await db.exec("reset role");
  }
}
const fails = async (uid, sql) => as(uid, sql).then(() => false, () => true);

await as(alice, `insert into public.books (user_id, title, pages) values ('${alice}', 'Alice book', '[{"id":"p1","fillDataUrl":"x","completedAt":"y"},{"id":"p2","isBlankBack":true}]')`);
check((await as(alice, "select count(*)::int n from public.books"))[0].n === 1, "owner sees their book");
check((await as(bob, "select count(*)::int n from public.books"))[0].n === 0, "another user does not");
check((await as(admin, "select count(*)::int n from public.books"))[0].n === 1, "supervisor sees every book");
check(await fails(bob, `insert into public.books (user_id, title) values ('${alice}', 'forged')`), "can't create a book as someone else");
await as(alice, `update public.books set user_id = '${bob}'`).catch(() => {});
check((await as(alice, "select count(*)::int n from public.books"))[0].n === 1, "can't give a book away to another user");

check((await as(admin, "select * from public.admin_list_users()")).length === 3, "supervisor lists users");
check(await fails(bob, "select * from public.admin_list_users()"), "non-supervisor can't list users");
check(await fails(admin, `select public.admin_set_supervisor('${admin}', false)`), "supervisor can't remove their own access");

const consume = async () => (await as(bob, "select public.consume_ai_credit('ai_image', 8) r"))[0].r;
const c1 = await consume(), c2 = await consume(), c3 = await consume();
check(c1.allowed && c2.allowed && !c3.allowed && c3.used === 16, "AI limit: 20/month default, 8+8 allowed, third refused", JSON.stringify(c3));
await as(bob, `select public.refund_ai_credit(${c2.event_id})`);
check((await as(bob, "select public.my_ai_usage() r"))[0].r.used === 8, "refund gives the credit back");
check((await as(admin, "select public.my_ai_usage() r"))[0].r.limit === null, "supervisors have no AI limit");
await as(admin, `select public.admin_set_ai_limit('${bob}', 100)`);
check((await consume()).allowed, "raised limit takes effect");
check(await fails(bob, `select public.admin_set_ai_limit('${bob}', 1000)`), "users can't raise their own limit");

const token = (await as(alice, "insert into public.book_shares (book_id) select id from public.books limit 1 returning token"))[0].token;
const shared = (await as(null, `select public.get_shared_book('${token}') r`))[0].r;
check(shared.pages.length === 1 && !("fillDataUrl" in shared.pages[0]) && !("completedAt" in shared.pages[0]), "share link: anonymous child gets clean pages, no blank backs", JSON.stringify(shared.pages));
check(await fails(bob, "insert into public.book_shares (book_id) select id from public.books limit 1") || (await as(bob, "select count(*)::int n from public.book_shares"))[0].n === 0, "can't share someone else's book");
await as(alice, `update public.book_shares set revoked_at = now() where token = '${token}'`);
check((await as(null, `select public.get_shared_book('${token}') r`))[0].r === null, "revoked link returns nothing");

await as(alice, "insert into public.page_comments (book_id, page_id, body) select id, 'p1', 'nice' from public.books limit 1");
check((await as(admin, "select author_email from public.page_comments"))[0]?.author_email === "alice@x.gr", "comment author comes from the session");
check((await as(bob, "select count(*)::int n from public.page_comments"))[0].n === 0, "outsiders can't read comments");

await as(alice, "insert into public.book_templates (title, pages) values ('Tpl', '[]')");
check((await as(bob, "select count(*)::int n from public.book_templates"))[0].n === 1, "templates visible to every signed-in user");
check((await as(null, "select count(*)::int n from public.book_templates").catch(() => [{ n: 0 }]))[0].n === 0, "templates hidden from anonymous visitors");
await as(bob, "delete from public.book_templates");
check((await as(alice, "select count(*)::int n from public.book_templates"))[0].n === 1, "others can't delete your template");
await as(admin, "delete from public.book_templates");
check((await as(alice, "select count(*)::int n from public.book_templates"))[0].n === 0, "supervisor can remove any template");

const stats = (await as(admin, "select public.admin_stats() r"))[0].r;
check(stats.users === 3 && stats.daily.length === 30, "admin_stats", `users ${stats.users}, ${stats.daily.length} days`);

console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
