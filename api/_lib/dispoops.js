// DISPO OPS -> Universal Team Hub (one way): a deal's progress as one hub task. Pure functions (no Firebase) so they
// can be tested on their own.
//
// A deal becomes "DISPO - <address>" in the DISPO owner's list (Carlos, DISPO), tagged "Added by DISPO OPS" with a
// link back. The task's note shows the overall % and the next DISPO OPS step with its owner. Each phase of the deal is
// a subtask: the phase name with its %, owned by the owner of that phase's next open step, Done at 100%, In Progress
// once anything in it is done. Closed in DISPO OPS = every phase Done; Cancelled = the hub's Cancelled status with a
// note; removed = a note, and syncing stops. Nothing flows back. sub.ext remembers what DISPO OPS last sent, so a
// person's own changes to titles in the hub are kept, and a task deleted in the hub is not brought back.
const crypto = require('crypto');

const APP = 'DISPO OPS';
const hash = s => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const J = JSON.stringify;
const ET = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const when = ts => { const p = Object.fromEntries(ET.formatToParts(new Date(ts)).map(x => [x.type, x.value])); return `${p.month}/${p.day}/${p.year} ${p.hour}:${p.minute} ET`; };
const mark = (o, was, is, now) => is === was ? o : { ...o, ...(is !== 'todo' && !o.startedAt ? { startedAt: now } : {}), doneAt: is === 'done' ? now : null };
const subStatus = s => s.status || (s.done ? 'done' : 'todo');
const statusOf = t => (t.subs.length ? t.subs.every(s => s.done) : t.done) ? 'done' : t.subs.some(s => s.done || s.status === 'progress') ? 'progress' : 'todo';

/** DISPO OPS stores owners by first name ("Carlos", "Sarah", "Remy"); the hub knows people by email. */
function nameFor(first, people, fallback) {
  let n = String(first || '').trim().toLowerCase(); if (!n || n === 'unassigned') return fallback;
  if (n === 'sarah') n = 'sara'; if (n === 'remy') n = 'systems';
  const key = Object.keys(people || {}).find(k => /@totalchb\.com$/.test(k) && k.split('@')[0] === n);
  return key ? ((people[key].name || '').trim() || key) : fallback;
}

/**
 * Lay a deal's progress over its hub task.
 *   task:    the hub task as stored (null if none yet);  link: the hubsync record (null the first time)
 *   payload: { deal: { id, address, url, strategy, status, percent, next, removed? }, phases: [{ phase, percent, complete, started, next }] }
 *   ctx:     { now, owner: { key, name }, people }
 * Returns { task (null = nothing to save), created, changed, skipped? }.
 */
function applyDispo(task, link, payload, ctx) {
  const now = ctx.now, deal = payload.deal || {}, phases = Array.isArray(payload.phases) ? payload.phases : [];
  if (!task && link && link.created) return { task: null, created: false, changed: false, skipped: 'deleted in the hub' };
  if (link && link.removed) return { task: null, created: false, changed: false, skipped: 'removed in DISPO OPS' };
  if (deal.removed) {
    if (!task) return { task: null, created: false, changed: false, removed: true };
    const t = JSON.parse(J(task));
    t.notes = [...(t.notes || []), { id: 'do-removed-' + now, text: 'Removed from DISPO OPS on ' + when(now) + '. This task is no longer updated.', by: APP, at: now }];
    t.log = [...(t.log || []), { at: now, by: APP, ev: 'removed in DISPO OPS' }].slice(-300);
    t.updatedBy = APP; t.updatedAt = now;
    return { task: t, created: false, changed: true, removed: true };
  }
  const created = !task, before = task ? J(task) : '';
  const title = 'DISPO - ' + ((deal.address || '').trim() || 'Deal ' + deal.id);
  const t = task ? JSON.parse(before) : { id: 'do-' + deal.id, company: 'tchb', title, owner: ctx.owner.name, done: false, order: now,
    subs: [], notes: [], source: APP, createdAt: now, createdBy: APP, ext: { app: 'dispo-ops', deal: deal.id, title, keys: [] }, log: [] };
  t.subs = t.subs || []; t.log = t.log || []; t.notes = t.notes || []; t.ext = t.ext || { app: 'dispo-ops', deal: deal.id, keys: [] };
  const log = (ev, x = {}) => t.log.push({ at: now, by: APP, ev, ...x });
  if (created) log('created', { title });
  const wasTask = statusOf(t), known = new Set(t.ext.keys || []), seen = new Set();
  const closed = deal.status === 'closed';
  for (const p of phases) {
    const key = String(p.phase || ''); if (!key) continue; seen.add(key);
    const id = 'do-' + hash(key), sTitle = `${key} (${Math.max(0, Math.min(100, Math.round(p.percent || 0)))}%)`;
    const had = t.subs.find(s => s.ext && s.ext.key === key);
    const owner = p.next ? nameFor(p.next.owner, ctx.people, ctx.owner.name) : (had && had.ext.owner) || ctx.owner.name;   // a finished phase keeps its last owner
    const want = closed || p.complete ? 'done' : p.started ? 'progress' : 'todo';
    const noteText = p.next ? `Next: ${p.next.title}${p.next.task && p.next.task !== p.next.title ? ' (' + p.next.task + ')' : ''} - ${owner}` : 'Phase complete.';
    const ext = { key, title: sTitle, owner, status: want, note: noteText };
    let i = t.subs.findIndex(s => s.ext && s.ext.key === key);
    if (i < 0) {
      if (known.has(key)) continue;                                           // removed in the hub: leave it out
      t.subs.push(mark({ id, title: sTitle, owner, status: want, done: want === 'done', createdAt: now, by: APP, at: now,
        notes: [{ id: id + '-next', text: noteText, by: APP, at: now }], ext }, 'todo', want, now));
      log('subtask added', { sid: id, title: sTitle, to: owner });
      continue;
    }
    const old = t.subs[i].ext || {}; let s = { ...t.subs[i] };
    if (s.title === old.title && sTitle !== old.title) s.title = sTitle;     // untouched in the hub: follow DISPO OPS
    if (s.owner === old.owner && owner !== old.owner) { s.owner = owner; log('owner', { sid: s.id, title: s.title, to: owner }); }
    if (noteText !== old.note) s.notes = (s.notes || []).map(n => n.id === id + '-next' ? { ...n, text: noteText, at: now } : n);
    if (want !== (old.status || 'todo')) { const was = subStatus(s); if (want !== was) { s = mark({ ...s, status: want, done: want === 'done', by: APP, at: now }, was, want, now); log(want === 'done' ? 'done' : want === 'progress' ? 'started' : 'not started', { sid: s.id, title: s.title }); } }
    s.ext = ext; t.subs[i] = s;
  }
  t.ext.keys = [...new Set([...(t.ext.keys || []), ...seen])];
  // the task's own note: overall % and the next step
  const overall = `Overall ${Math.max(0, Math.min(100, Math.round(deal.percent || 0)))}%` + (deal.next ? ` - Next: ${deal.next.title} (${nameFor(deal.next.owner, ctx.people, ctx.owner.name)})` : ' - every step done');
  const ni = t.notes.findIndex(n => n.id === 'do-overall');
  if (ni < 0) t.notes.push({ id: 'do-overall', text: overall, by: APP, at: now }); else if (t.notes[ni].text !== overall) t.notes[ni] = { ...t.notes[ni], text: overall, at: now };
  // status: Cancelled (the hub's own status), Closed (every phase Done above), Open again after either
  const st = deal.status || 'open', prev = t.ext.status || 'open';
  if (st !== prev) {
    if (st === 'cancelled') { t.status = 'cancelled'; t.notes.push({ id: 'do-cancelled-' + now, text: 'Cancelled in DISPO OPS on ' + when(now) + '.', by: APP, at: now }); log('cancelled'); }
    else if (prev === 'cancelled') { delete t.status; log('reopened'); }
    if (st === 'closed') t.notes.push({ id: 'do-closed-' + now, text: 'Closed in DISPO OPS on ' + when(now) + '.', by: APP, at: now });
  }
  t.ext.status = st;
  if (t.title === t.ext.title && title !== t.ext.title) t.title = title;
  t.ext.title = title; t.ext.url = deal.url || t.ext.url || ''; t.ext.deal = deal.id; t.ext.percent = deal.percent;
  if (t.subs.length) t.done = t.subs.every(s => s.done);
  const isTask = statusOf(t), out = created ? mark(t, 'todo', isTask, now) : mark(t, wasTask, isTask, now);
  out.log = out.log.slice(-300);
  const changed = created || J(out) !== before;
  if (changed) { out.updatedBy = APP; out.updatedAt = now; }
  return { task: changed ? out : null, created, changed };
}

module.exports = { APP, applyDispo, nameFor, hash };
