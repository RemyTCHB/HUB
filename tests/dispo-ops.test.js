// node --test tests/   (the DISPO OPS sync rules; made-up deals)
const test = require('node:test'), assert = require('node:assert');
const { applyDispo, nameFor } = require('../api/_lib/dispoops');

const people = { 'carlos@totalchb.com': { name: 'Carlos Test' }, 'sara@totalchb.com': { name: 'Sara Test' }, 'systems@totalchb.com': { name: 'Remy Test' }, 'sara@kpidriver.com': { name: 'Wrong Sara' } };
const owner = { key: 'carlos@totalchb.com', name: 'Carlos Test' };
const run = (task, link, p, now = 1000) => applyDispo(task, link, p, { now, owner, people });
const P = (x = {}, phases) => ({ deal: { id: 'prop_1', address: '1 Test St', url: 'https://dispo-ops.totalchb.com/?deal=prop_1', status: 'open', percent: 20, next: { title: 'Call', owner: 'Sarah' }, ...x },
  phases: phases || [{ phase: 'Phase I: Intake', percent: 50, complete: false, started: true, next: { group: 'Calls', title: 'Call', owner: 'Sarah' } }, { phase: 'Phase II: Market', percent: 0, complete: false, started: false, next: { group: 'Posts', title: 'Post', owner: 'Remy' } }] });

test('first sync: DISPO OPS - <address> in Carlos\'s list, one subtask per phase with its %, group and next task, owners from the directory', () => {
  const r = run(null, null, P()), t = r.task;
  assert.equal(r.created, true); assert.equal(t.id, 'do-prop_1'); assert.equal(t.title, 'DISPO OPS - 1 Test St'); assert.equal(t.ext.percent, 20); assert.equal(t.owner, 'Carlos Test');
  assert.equal(t.source, 'DISPO OPS'); assert.equal(t.ext.url, 'https://dispo-ops.totalchb.com/?deal=prop_1');
  assert.deepEqual(t.subs.map(s => [s.title, s.owner, s.status]), [['Phase I: Intake · 50%\nWorking On: Calls › Next: Call', 'Sara Test', 'progress'], ['Phase II: Market · 0%\nStarts With: Posts › Next: Post', 'Remy Test', 'todo']]);
  assert.equal(t.subs[0].notes[0].text, 'Next: Call (Calls) - Sara Test');
  assert.equal(t.notes.find(n => n.id === 'do-overall').text, 'Overall 20% - Next: Call (Sara Test)');
});

test('names: first names to hub names (Sarah = sara@, Remy = systems@), company accounts only', () => {
  assert.equal(nameFor('Sarah', people, 'x'), 'Sara Test'); assert.equal(nameFor('Remy', people, 'x'), 'Remy Test');
  assert.equal(nameFor('Nobody', people, 'Fallback'), 'Fallback'); assert.equal(nameFor('Unassigned', people, 'Fallback'), 'Fallback');
});

test('re-sync follows progress but keeps titles people changed in the hub', () => {
  const t = run(null, null, P()).task;
  t.subs[1].title = 'Marketing (renamed in the hub)';
  const r = run(t, { created: true }, P({ percent: 60 }, [{ phase: 'Phase I: Intake', percent: 100, complete: true, started: true, next: null }, { phase: 'Phase II: Market', percent: 30, complete: false, started: true, next: { group: 'Posts', title: 'Post', owner: 'Sarah' } }]), 2000);
  assert.deepEqual(r.task.subs.map(s => [s.title, s.status, s.owner]), [['Phase I: Intake · 100%\nComplete', 'done', 'Sara Test'], ['Marketing (renamed in the hub)', 'progress', 'Sara Test']]);
  assert.equal(r.task.subs[0].doneAt, 2000);
});

test('Closed = every phase Done; Cancelled = the hub\'s Cancelled status with a note; reopen clears it', () => {
  const t = run(null, null, P()).task;
  const c = run(t, { created: true }, P({ status: 'closed' }), 2000).task;
  assert.equal(c.done, true); assert.ok(c.subs.every(s => s.done)); assert.ok(c.notes.some(n => /Closed in DISPO OPS/.test(n.text)));
  const x = run(t, { created: true }, P({ status: 'cancelled' }), 3000).task;
  assert.equal(x.status, 'cancelled'); assert.ok(x.notes.some(n => /Cancelled in DISPO OPS/.test(n.text)));
  const o = run(x, { created: true }, P(), 4000).task; assert.equal(o.status, undefined);
});

test('a task deleted in the hub is not brought back; a removed deal gets a note and stops', () => {
  assert.equal(run(null, { created: true }, P()).task, null);
  const t = run(null, null, P()).task, r = run(t, { created: true }, { deal: { id: 'prop_1', removed: true } }, 5000);
  assert.equal(r.removed, true); assert.ok(r.task.notes.some(n => /Removed from DISPO OPS/.test(n.text)));
  assert.equal(run(r.task, { created: true, removed: true }, P()).task, null);
});

test('nothing changed, nothing saved', () => {
  const t = run(null, null, P()).task; assert.equal(run(t, { created: true }, P(), 9000).task, null);
});

test('a phase title without a group (older deals) still names the next task', () => {
  const { phaseTitle } = require('../api/_lib/dispoops');
  assert.equal(phaseTitle({ phase: 'Phase I: X', percent: 12.4, started: true, next: { group: '', title: 'Call' } }), 'Phase I: X · 12%\nNext: Call');
});
