// The daily digest email (owner 2026-11-23; api/_lib/digest.js builds it).
//   GET  (Vercel Cron, vercel.json, 12:00 and 13:00 UTC = 8:00 AM Eastern in summer / winter): sends everyone their
//        digest, once a day, only after 8 AM Eastern and only while HUB_DIGEST_ENABLED is "true" (the owner's go-live
//        switch). Vercel signs the call with CRON_SECRET.
//   POST (a signed-in person): { action: 'get' } → { on, live }; { action: 'set', on } turns their digest on or off;
//        { action: 'test' } sends their own digest to them only (works before go-live; once a minute at most).
// Sent through Resend (RESEND_API_KEY) from HUB_DIGEST_FROM (default Universal Team Hub <hub@totalchb.com>).
// Opt-outs and the day's run record live in meta/digest and digestRuns/ (server only: the rules give the page no
// access). Logs counts only.
const { app, db, rawBody, team, personKey, send } = require('../_lib/hub');
const { personDigest, digestEmail, isEmpty, window } = require('../_lib/digest');

const FROM = () => process.env.HUB_DIGEST_FROM || 'Universal Team Hub <hub@totalchb.com>';
const resendKey = () => process.env.RESEND_API_KEY || process.env.RESEND_KEY || process.env.RESEND || '';
const firstName = n => String(n || '').trim().split(/\s+/)[0] || 'there';

async function allTasks() {
  const [mgmt, items] = await Promise.all([db().collection('tasks').get(), db().collectionGroup('items').get()]);
  const personal = items.docs.filter(d => d.ref.path.startsWith('personal/')).map(d => ({ ...d.data(), list: d.ref.parent.parent.id }));
  return [...mgmt.docs.map(d => ({ ...d.data(), list: null })), ...personal];
}

/** Everyone's digest: [{ key, email, subject, html, empty }]. */
async function build(now, only) {
  const [who, tasks] = await Promise.all([team(), allTasks()]);
  const keys = only ? [only] : [...new Set([...Object.keys(who.people), ...who.managers])];
  return keys.map(key => {
    const d = personDigest({ key, tasks, keyOfName: who.keyOfName, nameOf: who.nameOf, now });
    return { key, email: key, empty: isEmpty(d), counts: d.counts, ...digestEmail(d, { first: firstName(who.nameOf(key) === key ? key.split('@')[0] : who.nameOf(key)), now }) };
  });
}

async function resend(emails) {
  const key = resendKey();
  if (!key) throw Object.assign(new Error('The hub has no Resend key yet (RESEND_API_KEY in Vercel).'), { code: 'nokey' });
  for (let i = 0; i < emails.length; i += 100) {
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify(emails.slice(i, i + 100).map(e => ({ from: FROM(), to: [e.email], subject: e.subject, html: e.html }))) });
    if (!r.ok) throw Object.assign(new Error('Resend answered ' + r.status + ': ' + (await r.text()).slice(0, 200)), { code: 'resend' });
  }
}

async function cron(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return send(res, 401, { error: 'Not the scheduler.' });
  if (process.env.HUB_DIGEST_ENABLED !== 'true') { console.log('digest: not live yet (HUB_DIGEST_ENABLED)'); return send(res, 200, { skipped: 'not live' }); }
  const now = Date.now(), w = window(now);
  if (w.hour < 8) return send(res, 200, { skipped: 'before 8 AM Eastern' });
  const run = db().doc('digestRuns/' + w.today);
  try { await run.create({ startedAt: now }); } catch (e) { return send(res, 200, { skipped: 'already sent today' }); }
  try {
    const off = ((await db().doc('meta/digest').get()).data() || {}).off || {};
    const all = await build(now), out = all.filter(e => !e.empty && !off[e.key]);
    await resend(out);
    const counts = { sent: out.length, empty: all.filter(e => e.empty).length, off: all.filter(e => off[e.key]).length };
    await run.set({ ...counts, at: Date.now() }, { merge: true });
    console.log(`digest ${w.today}: ${counts.sent} sent, ${counts.empty} with nothing to say, ${counts.off} turned off`);
    send(res, 200, counts);
  } catch (e) {
    await run.delete().catch(() => {});   // the next call today tries again
    console.error('digest failed', e.code || '', e.message || '');
    send(res, 500, { error: 'The digest could not be sent; the next run today tries again.' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return cron(req, res);
  if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST only' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.email_verified || !/@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 403, { error: 'Not a team account.' });
  const key = personKey(email), live = process.env.HUB_DIGEST_ENABLED === 'true';
  let body = {}; try { body = JSON.parse((await rawBody(req)) || '{}') || {}; } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const ref = db().doc('meta/digest');
  try {
    if (body.action === 'get') return send(res, 200, { on: !(((await ref.get()).data() || {}).off || {})[key], live });
    if (claims.imp) return send(res, 403, { error: 'Not while viewing the hub as someone else.' });
    if (body.action === 'set') {
      const on = !!body.on;
      await ref.set({ off: { [key]: on ? app().firestore.FieldValue.delete() : true } }, { merge: true });
      console.log(`digest: one person turned it ${on ? 'on' : 'off'}`);
      return send(res, 200, { on, live });
    }
    if (body.action === 'test') {
      const last = (((await ref.get()).data() || {}).testAt || {})[key] || 0;
      if (Date.now() - last < 60e3) return send(res, 429, { error: 'One test a minute: try again shortly.' });
      await ref.set({ testAt: { [key]: Date.now() } }, { merge: true });
      const [mine] = await build(Date.now(), key);
      await resend([{ ...mine, subject: '[Test] ' + mine.subject }]);
      console.log(`digest test: ${mine.counts.open} open, ${mine.counts.done} done`);
      return send(res, 200, { sent: true, to: email, open: mine.counts.open, done: mine.counts.done });
    }
    send(res, 400, { error: 'Unknown action.' });
  } catch (e) {
    console.error('digest', body.action, e.code || '', e.message || '');
    send(res, e.code === 'nokey' ? 503 : 500, { error: e.code === 'nokey' || e.code === 'resend' ? e.message : 'The digest could not be sent. Try again.' });
  }
};
