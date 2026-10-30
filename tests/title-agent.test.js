// node --test tests/   (the Title Commitment Agent sync rules)
const test = require('node:test'), assert = require('node:assert');
const { applyDeal, hubChanges, dueMs, sign, verify, hash } = require('../api/_lib/titleagent');

const owner = { key: 'monz@totalchb.com', name: 'Monz Miller' };
const B = (key, x = {}) => ({ key, priority: 'blocker', title: 'Item ' + key, action: 'Do ' + key, sources: ['B-I ' + key], due_date: null, status: 'Open', ...x });
const deal = (blockers, x = {}) => ({ deal: { id: 12, address: '123 Main St, Akron, OH', url: 'https://title.totalchb.com/#/deal/12', ...x }, blockers, complete: true });
const run = (task, link, p, now = 1000) => applyDeal(task, link, p, { now, owner, company: 'tchb' });

test('first sync creates the task in Monz\'s list with one subtask per Closing Blocker', () => {
  const r = run(null, null, deal([B('1', { due_date: '2026-11-05' }), B('2', { priority: 'before' }), B('3', { status: 'Cleared' })]));
  const t = r.task;
  assert.equal(r.created, true);
  assert.equal(t.id, 'ta-12'); assert.equal(t.title, 'Title - 123 Main St, Akron, OH'); assert.equal(t.owner, 'Monz Miller');
  assert.equal(t.source, 'Title Commitment Agent'); assert.equal(t.createdBy, 'Title Commitment Agent');
  assert.deepEqual(t.subs.map(s => s.title), ['Item 1', 'Item 3'], 'Before Closing items are left out');
  assert.equal(t.subs[0].notes[0].text, 'Action needed: Do 1\nSource: B-I 1');
  assert.equal(t.subs[0].notes[0].by, 'Title Commitment Agent');
  assert.equal(new Date(t.subs[0].due).toISOString(), '2026-11-05T14:00:00.000Z', '9:00 AM Eastern');
  assert.equal(t.due, t.subs[0].due, 'task due = earliest open blocker');
  assert.equal(t.subs[1].done, true); assert.equal(t.subs[1].status, 'done');
  assert.equal(t.log[0].ev, 'created');
});

test('no blockers, no task', () => { assert.equal(run(null, null, deal([B('2', { priority: 'fyi' })])).task, null); });

test('a deleted task is not brought back', () => { assert.equal(run(null, { created: true }, deal([B('1')])).task, null); });

test('re-sync: new blockers added, untouched text and dates follow the agent, edited ones are kept', () => {
  let t = run(null, null, deal([B('1', { due_date: '2026-11-05' }), B('2')])).task;
  t.subs[1].title = 'Renamed by Monz';
  t.subs[0].due = dueMs('2026-11-01');                                  // Monz moved the due date himself
  const r = run(t, { created: true }, deal([B('1', { title: 'New 1', due_date: '2026-11-09', action: 'Do it better' }), B('2', { title: 'New 2' }), B('4')]), 2000);
  const subs = r.task.subs;
  assert.deepEqual(subs.map(s => s.title), ['New 1', 'Renamed by Monz', 'Item 4']);
  assert.equal(subs[0].due, dueMs('2026-11-01'), 'his date stays');
  assert.equal(subs[0].notes[0].text, 'Action needed: Do it better\nSource: B-I 1');
  assert.ok(r.task.log.some(e => e.ev === 'subtask added' && e.title === 'Item 4'));
});

test('done in the agent -> done in the hub; done in the hub -> sent to the agent', () => {
  let t = run(null, null, deal([B('1'), B('2')])).task;
  let r = run(t, { created: true }, deal([B('1', { status: 'Cleared' }), B('2')]), 2000);
  assert.equal(r.task.subs[0].done, true); assert.ok(r.task.subs[0].doneAt); assert.deepEqual(r.updates, []);
  t = r.task; t.subs[1] = { ...t.subs[1], done: true, status: 'done', by: 'Monz Miller' };
  assert.deepEqual(hubChanges(t), [{ key: '2', status: 'Cleared', by: 'Monz Miller' }]);
  r = run(t, { created: true }, deal([B('1', { status: 'Cleared' }), B('2')]), 3000);
  assert.deepEqual(r.updates, [{ key: '2', status: 'Cleared', by: 'Monz Miller' }]);
  assert.equal(r.task.subs[1].done, true, 'the hub tick is not undone');
  assert.equal(r.task.done, true);
  t = r.task;
  r = run(t, { created: true }, deal([B('1', { status: 'Cleared' }), B('2', { status: 'Cleared' })]), 4000);
  assert.deepEqual(r.updates, []); assert.equal(r.changed, false, 'nothing left to do'); assert.equal(r.task, null, 'nothing to save');
  r = run(t, { created: true }, deal([B('1', { status: 'Open' }), B('2', { status: 'Cleared' })]), 5000);
  assert.equal(r.task.subs[0].done, false, 'reopened in the agent'); assert.ok(r.task.log.some(e => e.ev === 'reopened'));
});

test('blockers dropped by the agent stay, with a note; removed in the hub stay removed', () => {
  let t = run(null, null, deal([B('1'), B('2')])).task;
  let r = run(t, { created: true }, deal([B('1')]), 2000);
  assert.equal(r.task.subs.length, 2); assert.equal(r.task.subs[1].ext.gone, true);
  assert.match(r.task.subs[1].notes.at(-1).text, /^Cleared from the list by Title Commitment Agent on /);
  t = r.task; t.subs = t.subs.slice(1);                                   // Monz deletes blocker 1 in the hub
  r = run(t, { created: true }, deal([B('1'), B('2')]), 3000);
  assert.deepEqual(r.task.subs.map(s => s.ext.key), ['2']);
  assert.match(r.task.subs[0].notes.at(-1).text, /^Back on the list/);
});

test('signatures', () => {
  const body = '{"a":1}', h = sign('s3cret', body, 1000);
  assert.equal(verify('s3cret', body, h['X-Hub-Timestamp'], h['X-Hub-Signature'], 1100), true);
  assert.equal(verify('s3cret', body + ' ', h['X-Hub-Timestamp'], h['X-Hub-Signature'], 1100), false);
  assert.equal(verify('other', body, h['X-Hub-Timestamp'], h['X-Hub-Signature'], 1100), false);
  assert.equal(verify('s3cret', body, h['X-Hub-Timestamp'], h['X-Hub-Signature'], 2000), false, 'too old');
  assert.equal(hash('k').length, 12);
});

test('team: the Managers, then the TC department with Team Leaders first; other departments left out', () => {
  const { teamFor } = require('../api/_lib/titleagent');
  const people = {
    'systems@totalchb.com': { name: 'Ahmed Ramy', order: 1, photo: 'https://img.example/a.jpg' },
    'boss@totalchb.com': { name: 'Bo Boss', role: 'member', order: 2 },
    'monz@totalchb.com': { name: 'Monz Miller', role: 'member', dept: 'TC', order: 5 },
    'tl@totalchb.com': { name: 'Tia Lead', role: 'lead', dept: 'TC', order: 9 },
    'dispo@totalchb.com': { name: 'Dee Spo', role: 'lead', dept: 'DISPO', order: 3 } };
  const out = teamFor(people, ['brandy@totalchb.com', 'systems@totalchb.com', 'boss@totalchb.com']);
  assert.deepEqual(out.map(p => [p.email, p.role, p.dept]), [
    ['systems@totalchb.com', 'manager', ''], ['boss@totalchb.com', 'manager', ''], ['brandy@totalchb.com', 'manager', ''],
    ['tl@totalchb.com', 'lead', 'TC'], ['monz@totalchb.com', 'member', 'TC']]);
  assert.deepEqual(out[0], { name: 'Ahmed Ramy', email: 'systems@totalchb.com', role: 'manager', dept: '', photo: 'https://img.example/a.jpg' });
  assert.equal(out[2].name, 'brandy@totalchb.com', 'a manager missing from the directory falls back to the email');
  assert.equal(out[4].photo, '');
});
