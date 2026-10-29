// Title Commitment Agent <-> Universal Team Hub: the rules for turning a deal's Closing Blockers into one hub task
// and keeping the two apps' done/not-done in step. Pure functions (no Firebase) so they can be tested on their own.
//
// A deal becomes the task "Title - <address>" in the owner's list (Monz, TC). Each Closing Blocker is a subtask:
// title = the Item, one note = "Action needed: ... / Source: ...", due = the item's due date (9:00 AM Eastern when
// only a date is given), status from the agent. sub.ext remembers what the agent last sent, so a re-sync only
// changes what a person hasn't changed since, and a status that changed on one side is copied to the other.
const crypto = require('crypto');

const AGENT = 'Title Commitment Agent';
const DONE = new Set(['Cleared', 'Waived']);
const toHub = s => DONE.has(s) ? 'done' : s === 'Ordered' || s === 'Received' ? 'progress' : 'todo';
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const J = JSON.stringify;

// 'YYYY-MM-DD' (9:00 AM Eastern) or a full ISO time -> ms
const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const etParts = ts => Object.fromEntries(ET.formatToParts(new Date(ts)).map(p => [p.type, p.value]));
function dueMs(v) {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v).trim());
  if (!m) { const t = Date.parse(v); return isNaN(t) ? null : t; }
  const want = Date.UTC(+m[1], m[2] - 1, +m[3], 9, 0); let ts = want;
  for (let i = 0; i < 3; i++) { const p = etParts(ts); ts += want - Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute); }
  return ts;
}
const when = ts => { const p = etParts(ts); return `${p.month}/${p.day}/${p.year} ${p.hour}:${p.minute} ET`; };

const subStatus = s => s.status || (s.done ? 'done' : 'todo');
const statusOf = t => (t.subs.length ? t.subs.every(s => s.done) : t.done) ? 'done' : t.subs.some(s => s.done || s.status === 'progress') ? 'progress' : 'todo';
// Same dates the app keeps for the EOD report: first time In Progress (or Done), and when finished.
const mark = (o, was, is, now) => is === was ? o : { ...o, ...(is !== 'todo' && !o.startedAt ? { startedAt: now } : {}), doneAt: is === 'done' ? now : null };
const noteText = b => ['Action needed: ' + (b.action || '').trim(), 'Source: ' + ((b.sources || []).filter(Boolean).join(', ') || 'Title commitment')].join('\n');

/**
 * Lay one deal's Closing Blockers over its hub task.
 *   task:    the hub task as stored (null if there is none yet)
 *   link:    hubsync record for the deal (null the first time); link.created means the task was made before
 *   payload: { deal: { id, address, url }, blockers: [{ key, title, action, sources, due_date, status, priority }] }
 *   ctx:     { now, owner: { key, name }, company }
 * Returns { task (null = nothing to save), created, changed, updates: [{ key, status, by }] for the agent }.
 */
function applyDeal(task, link, payload, ctx) {
  const now = ctx.now, deal = payload.deal || {}, blockers = (payload.blockers || []).filter(b => b && b.key && (!b.priority || b.priority === 'blocker'));
  if (!task && link && link.created) return { task: null, created: false, changed: false, updates: [], skipped: 'deleted in the hub' };
  if (!task && !blockers.length) return { task: null, created: false, changed: false, updates: [] };
  const created = !task, before = task ? J(task) : '';
  const title = 'Title - ' + ((deal.address || '').trim() || 'Deal ' + deal.id);
  const t = task ? JSON.parse(before) : { id: 'ta-' + deal.id, company: ctx.company || 'tchb', title, owner: ctx.owner.name, done: false, order: now,
    subs: [], notes: [], source: AGENT, createdAt: now, createdBy: AGENT, ext: { app: 'title-agent', deal: deal.id, title, keys: [] }, log: [] };
  t.subs = t.subs || []; t.ext = t.ext || { app: 'title-agent', deal: deal.id, keys: [] }; t.log = t.log || [];
  const log = (ev, x = {}) => t.log.push({ at: now, by: AGENT, ev, ...x });
  if (created) log('created', { title });
  const wasTask = statusOf(t), seen = new Set(), known = new Set(t.ext.keys || []), updates = [];
  for (const b of blockers) {
    seen.add(b.key);
    const id = 'ta-' + hash(b.key), due = dueMs(b.due_date), sub = t.subs.find(s => s.ext && s.ext.key === b.key);
    const ext = { key: b.key, title: b.title, note: noteText(b), due, status: b.status || 'Open' };
    if (!sub) {
      if (known.has(b.key)) continue;                                    // someone removed it in the hub: leave it out
      const st = toHub(ext.status);
      t.subs.push(mark({ id, title: b.title, owner: ctx.owner.name, status: st, done: st === 'done', createdAt: now, by: AGENT, at: now,
        ...(due ? { due, dueSet: now } : {}), notes: [{ id: id + '-src', text: ext.note, by: AGENT, at: now }], ext }, 'todo', st, now));
      log('subtask added', { sid: id, title: b.title, to: ctx.owner.name });
      continue;
    }
    const old = sub.ext || {}, i = t.subs.indexOf(sub); let s = { ...sub };
    if (old.gone) { s.notes = [...(s.notes || []), { id: id + '-back-' + now, text: 'Back on the list from ' + AGENT + ' on ' + when(now), by: AGENT, at: now }]; }
    if (s.title === old.title && b.title !== old.title) s.title = b.title;  // untouched here: follow the agent
    if (ext.note !== old.note) s.notes = (s.notes || []).map(n => n.id === id + '-src' && n.text === old.note ? { ...n, text: ext.note, at: now } : n);
    if ((s.due || null) === (old.due || null) && due !== (old.due || null)) { s = { ...s, due, dueSet: due ? now : null }; log('due', { sid: s.id, title: s.title, due }); }
    const hubDone = !!s.done, agentWasDone = DONE.has(old.status || 'Open');
    if (ext.status !== (old.status || 'Open')) {                         // changed in the agent: copy it here
      const was = subStatus(s), st = toHub(ext.status);
      if (st !== was) { s = mark({ ...s, status: st, done: st === 'done', by: AGENT, at: now }, was, st, now); log(st === 'done' ? 'done' : was === 'done' ? 'reopened' : st === 'progress' ? 'started' : 'not started', { sid: s.id, title: s.title }); }
    } else if (hubDone !== agentWasDone) {                               // changed in the hub: send it to the agent
      ext.status = hubDone ? 'Cleared' : 'Open';
      updates.push({ key: b.key, status: ext.status, by: s.by || 'Universal Team Hub' });
    }
    s.ext = ext; t.subs[i] = s;
  }
  // Blockers the agent no longer lists: kept, with a note (never deleted).
  t.subs = t.subs.map(s => {
    if (!s.ext || !s.ext.key || seen.has(s.ext.key) || s.ext.gone) return s;
    if (!payload.complete) return s;                                     // only a full list can say something is gone
    return { ...s, ext: { ...s.ext, gone: true }, notes: [...(s.notes || []), { id: s.id + '-gone-' + now, text: 'Cleared from the list by ' + AGENT + ' on ' + when(now), by: AGENT, at: now }] };
  });
  t.ext.keys = [...new Set([...(t.ext.keys || []), ...seen])];
  if (t.title === t.ext.title && title !== t.ext.title) t.title = title;
  t.ext.title = title; t.ext.url = deal.url || t.ext.url || ''; t.ext.deal = deal.id;
  // The task is due when its earliest open blocker is due (unless someone set the task's due date by hand).
  // Once every blocker is done the last due date stays (the EOD report compares due with done).
  const dues = t.subs.filter(s => s.ext && !s.ext.gone && !s.done && s.due).map(s => s.due), due = dues.length ? Math.min(...dues) : (t.ext.due || null);
  if ((t.due || null) === (t.ext.due || null) && due !== (t.ext.due || null)) { t.due = due; t.dueSet = due ? now : null; if (!created) log('due', { due }); }
  t.ext.due = due;
  if (t.subs.length) t.done = t.subs.every(s => s.done);
  const isTask = statusOf(t), out = created ? { ...mark(t, 'todo', isTask, now) } : mark(t, wasTask, isTask, now);
  if (!created && wasTask !== isTask) out.log.push({ at: now, by: AGENT, ev: isTask === 'done' ? 'done' : wasTask === 'done' ? 'reopened' : isTask === 'progress' ? 'started' : 'not started' });
  out.log = out.log.slice(-300);
  const changed = created || J(out) !== before;
  if (changed) { out.updatedBy = AGENT; out.updatedAt = now; }
  return { task: changed ? out : null, created, changed, updates };
}

/** The hub side's own changes to report to the agent (someone ticked or unticked a blocker in the hub). */
function hubChanges(task) {
  return (task.subs || []).filter(s => s.ext && s.ext.key && !s.ext.gone && !!s.done !== DONE.has(s.ext.status || 'Open'))
    .map(s => ({ key: s.ext.key, status: s.done ? 'Cleared' : 'Open', by: s.by || 'Universal Team Hub' }));
}

// Shared-secret signatures between the two apps: HMAC-SHA256 of "<unix seconds>.<raw body>", 5 minutes' leeway.
function sign(secret, body, ts = Math.floor(Date.now() / 1000)) {
  return { 'X-Hub-Timestamp': String(ts), 'X-Hub-Signature': 'sha256=' + crypto.createHmac('sha256', secret).update(ts + '.' + body).digest('hex') };
}
function verify(secret, body, ts, sig, nowSec = Math.floor(Date.now() / 1000)) {
  if (!secret || !ts || !sig || Math.abs(nowSec - Number(ts)) > 300) return false;
  const want = Buffer.from(sign(secret, body, Number(ts))['X-Hub-Signature']), got = Buffer.from(String(sig));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

module.exports = { AGENT, DONE, applyDeal, hubChanges, dueMs, sign, verify, hash, toHub };
