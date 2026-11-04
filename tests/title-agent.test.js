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

test('team: an app can ask for more departments (TC Checklist: TC and DISPO); unknown ones are ignored', () => {
  const { teamFor, deptsFrom } = require('../api/_lib/titleagent');
  const people = {
    'systems@totalchb.com': { name: 'Ahmed Ramy', order: 1 },
    'monz@totalchb.com': { name: 'Monz Miller', role: 'member', dept: 'TC', order: 5 },
    'dm@totalchb.com': { name: 'Dana Member', role: 'member', dept: 'DISPO', order: 4 },
    'dispo@totalchb.com': { name: 'Dee Spo', role: 'lead', dept: 'DISPO', order: 6 },
    'acq@totalchb.com': { name: 'Ace Q', role: 'member', dept: 'ACQ', order: 2 } };
  const out = teamFor(people, ['systems@totalchb.com'], deptsFrom(['tc', 'DISPO', 'nope']));
  assert.deepEqual(out.map(p => [p.email, p.role, p.dept]), [
    ['systems@totalchb.com', 'manager', ''], ['monz@totalchb.com', 'member', 'TC'],
    ['dispo@totalchb.com', 'lead', 'DISPO'], ['dm@totalchb.com', 'member', 'DISPO']]);
  assert.deepEqual(deptsFrom(undefined), ['TC'], 'no list: TC only, as before');
  assert.deepEqual(deptsFrom(['nope']), ['TC']);
  assert.deepEqual(teamFor(people, ['systems@totalchb.com']).map(p => p.email), ['systems@totalchb.com', 'monz@totalchb.com'], 'the Title Commitment Agent still gets Managers + TC');
});

test('a blocker cancelled in the hub does not count: the deal is done when the rest are cleared', () => {
  let t = run(null, null, deal([B('1'), B('2')])).task;
  t.subs[1] = { ...t.subs[1], status: 'cancelled', done: false };       // cancelled in the hub
  const r = run(t, { created: true }, deal([B('1', { status: 'Cleared' }), B('2')]), 2000);
  assert.equal(r.task.done, true, 'only the open blocker counts');
  assert.equal(r.task.subs[1].status, 'cancelled', 'the cancelled one stays cancelled');
  assert.ok(r.task.log.some(e => e.ev === 'done' && !e.sid));
  assert.deepEqual(r.updates, [], 'nothing to send back for a cancelled blocker the agent still lists as Open');
  t = { ...r.task, subs: r.task.subs.map(s => ({ ...s, status: 'cancelled', done: false })) };
  const all = run(t, { created: true }, deal([B('1', { status: 'Cleared' }), B('2')]), 3000);
  assert.equal(all.task && all.task.done, false, 'every blocker cancelled: the task is cancelled, not done');
  assert.deepEqual(all.updates, [], 'cancelling a cleared blocker does not reopen it in the agent');
  assert.deepEqual(hubChanges(t), [], 'nor does the hub page report it');
  const back = run(r.task, { created: true }, deal([B('1', { status: 'Cleared' }), B('2'), B('3')]), 4000);
  assert.equal(back.task.done, false, 'a new open blocker reopens the task');
  assert.ok(back.task.log.some(e => e.ev === 'reopened' && !e.sid));
});

test('passwords: signed with the agent\'s secret only, team emails only, the same answer as the hub\'s Help', async () => {
  // A stand-in team directory, so the handler runs without Firebase.
  const hub = require('../api/_lib/hub');
  const people = { 'brandy@totalchb.com': { name: 'Brandy Pollack', role: 'manager' }, 'monz@totalchb.com': { name: 'Monz', role: 'lead', dept: 'TC', sees: ['TC', 'DISPO'], deptView: true },
    'will@totalchb.com': { name: 'Will', role: 'member', dept: 'TC' } };
  const realTeam = hub.team; hub.team = async () => ({ people, managers: ['brandy@totalchb.com', 'systems@totalchb.com'] });
  const env = { ...process.env };
  Object.assign(process.env, { TITLE_AGENT_SYNC_SECRET: 'agent-secret', TC_CHECKLIST_SYNC_SECRET: 'checklist-secret',
    HUB_DELETE_PASSWORDS: JSON.stringify({ leads: { TC: 'l-tc', DISPO: 'l-di', ACQ: 'l-acq' }, subtasks: { TC: 's-tc' }, people: { 'brandy@totalchb.com': 'b-own' } }) });
  delete require.cache[require.resolve('../api/title-agent/passwords')];
  const handler = require('../api/title-agent/passwords');
  const call = async (bodyObj, secret = 'agent-secret', method = 'POST') => {
    const body = JSON.stringify(bodyObj), h = sign(secret, body), out = { headers: {} };
    const logs = []; const log = console.log; console.log = (...a) => logs.push(a.join(' '));
    try {
      await handler({ method, body, headers: { 'x-hub-timestamp': h['X-Hub-Timestamp'], 'x-hub-signature': h['X-Hub-Signature'] } },
        { setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; }, end: s => { out.body = JSON.parse(s); }, set statusCode(c) { out.code = c; } });
    } finally { console.log = log; }
    return { ...out, logs };
  };
  try {
    const lead = await call({ email: 'Monz@TotalCHB.com' });
    assert.equal(lead.code, 200);
    assert.deepEqual(lead.body, { rows: [{ dept: 'TC', lead: 'l-tc', sub: 's-tc' }, { dept: 'DISPO', lead: 'l-di', sub: '' }], own: [] });
    assert.equal(lead.headers['cache-control'], 'no-store');
    assert.ok(lead.logs.every(l => !/l-tc|s-tc|l-di|b-own/.test(l)), 'logs counts only, never a password');
    const mgr = await call({ email: 'systems@kpidriver.com' });             // second login → systems@totalchb.com
    assert.deepEqual(mgr.body.rows.map(r => r.dept), ['TC', 'DISPO', 'ACQ']); assert.deepEqual(mgr.body.own, [{ name: 'Brandy Pollack', pw: 'b-own' }]);
    assert.deepEqual((await call({ email: 'will@totalchb.com' })).body, { rows: [], own: [] }, 'members: none');
    assert.equal((await call({ email: 'monz@totalchb.com' }, 'checklist-secret')).code, 401, 'TC Checklist\'s secret does not open this');
    assert.equal((await call({ email: 'someone@gmail.com' })).code, 400, 'not a team email');
    assert.equal((await call({})).code, 400, 'no email');
    assert.equal((await call({ email: 'x@totalchb.com.evil.com' })).code, 400);
    assert.equal((await call({ email: 'monz@totalchb.com' }, 'agent-secret', 'GET')).code, 405);
  } finally {
    hub.team = realTeam; for (const k of ['TITLE_AGENT_SYNC_SECRET', 'TC_CHECKLIST_SYNC_SECRET', 'HUB_DELETE_PASSWORDS']) { if (k in env) process.env[k] = env[k]; else delete process.env[k]; }
  }
});

test('team: the agent, TC Checklist and Dispo Ops each sign with their own secret; the passwords stay agent-only', async () => {
  const hub = require('../api/_lib/hub');
  const people = { 'monz@totalchb.com': { name: 'Monz', role: 'lead', dept: 'TC', order: 1 }, 'sara@totalchb.com': { name: 'Sara', role: 'member', dept: 'DISPO', order: 2 } };
  const realTeam = hub.team; hub.team = async () => ({ people, managers: ['brandy@totalchb.com'] });
  const KEYS = ['TITLE_AGENT_SYNC_SECRET', 'TC_CHECKLIST_SECRET', 'TC_CHECKLIST_SYNC_SECRET', 'DISPO_OPS_SECRET', 'HUB_DELETE_PASSWORDS'], env = { ...process.env };
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, { TITLE_AGENT_SYNC_SECRET: 'agent-secret', TC_CHECKLIST_SECRET: 'checklist-secret', DISPO_OPS_SECRET: 'dispo-secret', HUB_DELETE_PASSWORDS: '{}' });
  for (const f of ['team', 'passwords']) delete require.cache[require.resolve('../api/title-agent/' + f)];
  const run = async (handler, bodyObj, secret) => {
    const body = JSON.stringify(bodyObj), h = sign(secret, body), out = {}; const log = console.log; console.log = () => {};
    try { await handler({ method: 'POST', body, headers: { 'x-hub-timestamp': h['X-Hub-Timestamp'], 'x-hub-signature': h['X-Hub-Signature'] } },
      { setHeader() {}, end: s => { out.body = JSON.parse(s); }, set statusCode(c) { out.code = c; } }); } finally { console.log = log; }
    return out;
  };
  try {
    const team = require('../api/title-agent/team'), pw = require('../api/title-agent/passwords');
    for (const s of ['agent-secret', 'checklist-secret', 'dispo-secret']) assert.equal((await run(team, { depts: ['TC', 'DISPO'] }, s)).code, 200, s);
    assert.deepEqual((await run(team, { depts: ['DISPO'] }, 'dispo-secret')).body.people.map(p => p.email), ['brandy@totalchb.com', 'sara@totalchb.com']);
    assert.equal((await run(team, {}, 'wrong-secret')).code, 401);
    assert.equal((await run(pw, { email: 'monz@totalchb.com' }, 'dispo-secret')).code, 401, 'Dispo Ops\' secret does not open the passwords');
    assert.equal((await run(pw, { email: 'monz@totalchb.com' }, 'checklist-secret')).code, 401);
    delete process.env.TC_CHECKLIST_SECRET; process.env.TC_CHECKLIST_SYNC_SECRET = 'old-name-secret';
    assert.equal((await run(team, {}, 'old-name-secret')).code, 200, 'the older name still works');
  } finally {
    hub.team = realTeam; for (const k of KEYS) { if (k in env) process.env[k] = env[k]; else delete process.env[k]; }
  }
});
