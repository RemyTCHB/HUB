// node --test tests/deletes.test.js   (who may delete tasks and subtasks, and with which password)
const test = require('node:test'), assert = require('node:assert');
const { deleteRule, passwordCheck, readPasswords } = require('../api/_lib/deletes');

const people = {
  'systems@totalchb.com': { name: 'Remy' }, 'brandy@totalchb.com': { name: 'Brandy' }, 'boss@totalchb.com': { name: 'Bo' },
  'lead@totalchb.com': { name: 'Tia Lead', role: 'lead', dept: 'TC', sees: ['TC'], deptView: true },
  'monz@totalchb.com': { name: 'Monz', role: 'member', dept: 'TC', sees: ['TC'] },
  'mo@totalchb.com': { name: 'Mo', role: 'member', dept: 'TC', sees: ['TC'], deptView: true },
  'dee@totalchb.com': { name: 'Dee', role: 'lead', dept: 'DISPO', sees: ['DISPO'], deptView: true },
  'nod@totalchb.com': { name: 'No Dept', role: 'member' } };
const managers = ['brandy@totalchb.com', 'systems@totalchb.com', 'boss@totalchb.com'];
const keyOfName = n => Object.keys(people).find(k => people[k].name === n) || '';
const rule = (me, kind, list, task = {}, own = false) => deleteRule({ me, kind, list, task: { owner: '', subs: [], members: [], ...task }, people, managers, keyOfName, hasOwnPassword: own });
const conf = readPasswords(JSON.stringify({ leads: { TC: 'tl-tc' }, subtasks: { TC: 'sub-tc' }, people: { 'brandy@totalchb.com': 'b-pw' } }));

test('Remy only confirms, for tasks and subtasks anywhere', () => {
  assert.deepEqual(rule('systems@totalchb.com', 'task', 'monz@totalchb.com'), { need: 'confirm' });
  assert.deepEqual(rule('systems@totalchb.com', 'sub', ''), { need: 'confirm' });
});

test('Brandy uses her own password for tasks and subtasks', () => {
  assert.deepEqual(rule('brandy@totalchb.com', 'task', 'monz@totalchb.com', {}, true), { need: 'person' });
  assert.deepEqual(rule('brandy@totalchb.com', 'sub', '', {}, true), { need: 'person' });
  assert.equal(passwordCheck({ need: 'person' }, 'brandy@totalchb.com', 'b-pw', conf), 'ok');
  assert.equal(passwordCheck({ need: 'person' }, 'brandy@totalchb.com', 'tl-tc', conf), 'wrong');
});

test('tasks: Team Leaders and other managers need the department TL password; members cannot', () => {
  assert.deepEqual(rule('lead@totalchb.com', 'task', 'monz@totalchb.com'), { need: 'lead', dept: 'TC' });
  assert.deepEqual(rule('boss@totalchb.com', 'task', 'monz@totalchb.com'), { need: 'lead', dept: 'TC' });
  assert.ok(rule('mo@totalchb.com', 'task', 'monz@totalchb.com').refuse, 'a member with Dept View');
  assert.ok(rule('dee@totalchb.com', 'task', 'monz@totalchb.com').refuse, 'a DISPO lead can\'t see TC');
  assert.equal(passwordCheck({ need: 'lead', dept: 'TC' }, 'lead@totalchb.com', 'tl-tc', conf), 'ok');
  assert.equal(passwordCheck({ need: 'lead', dept: 'TC' }, 'lead@totalchb.com', 'sub-tc', conf), 'wrong');
  assert.equal(passwordCheck({ need: 'lead', dept: 'DISPO' }, 'dee@totalchb.com', 'x', conf), 'unset');
});

test('tasks: your own list needs no password; MGMT tasks are managers only', () => {
  assert.deepEqual(rule('monz@totalchb.com', 'task', 'monz@totalchb.com'), { need: 'confirm' });
  assert.deepEqual(rule('boss@totalchb.com', 'task', ''), { need: 'confirm' });
  assert.ok(rule('monz@totalchb.com', 'task', '', { members: ['tchb:monz@totalchb.com'], owner: 'Monz' }).refuse);
});

test('subtasks: anyone on the task with the department subtask password', () => {
  assert.deepEqual(rule('monz@totalchb.com', 'sub', 'monz@totalchb.com'), { need: 'sub', dept: 'TC' });
  assert.deepEqual(rule('mo@totalchb.com', 'sub', 'monz@totalchb.com'), { need: 'sub', dept: 'TC' });
  assert.deepEqual(rule('lead@totalchb.com', 'sub', 'monz@totalchb.com'), { need: 'sub', dept: 'TC' });
  assert.equal(passwordCheck({ need: 'sub', dept: 'TC' }, 'mo@totalchb.com', 'sub-tc', conf), 'ok');
  assert.equal(passwordCheck({ need: 'sub', dept: 'TC' }, 'mo@totalchb.com', 'tl-tc', conf), 'wrong');
  assert.ok(rule('dee@totalchb.com', 'sub', 'monz@totalchb.com').refuse, 'not on the task');
  assert.ok(rule('nod@totalchb.com', 'sub', 'nod@totalchb.com').refuse, 'no department, not a manager');
  assert.deepEqual(rule('boss@totalchb.com', 'sub', 'boss@totalchb.com'), { need: 'confirm' }, 'a manager\'s own list');
});

test('subtasks on a shared task: only when the whole task is yours; MGMT subtasks are managers only', () => {
  const shared = { owner: 'Monz', members: ['tchb:monz@totalchb.com', 'tchb:mo@totalchb.com'] };
  assert.ok(rule('dee@totalchb.com', 'sub', 'lead@totalchb.com', { members: ['tchb:dee@totalchb.com'], owner: 'Tia Lead' }).refuse);
  assert.deepEqual(rule('dee@totalchb.com', 'sub', 'lead@totalchb.com', { members: ['tchb:dee@totalchb.com'], owner: 'Dee' }), { need: 'sub', dept: 'TC' });
  assert.ok(rule('monz@totalchb.com', 'sub', '', shared).refuse);
  assert.deepEqual(rule('boss@totalchb.com', 'sub', '', shared), { need: 'confirm' });
});

test('a broken or missing password setting refuses instead of letting deletes through', () => {
  assert.deepEqual(readPasswords('not json'), {});
  assert.equal(passwordCheck({ need: 'sub', dept: 'TC' }, 'mo@totalchb.com', '', readPasswords('')), 'unset');
  assert.equal(passwordCheck({ need: 'sub', dept: 'TC' }, 'mo@totalchb.com', '', conf), 'wrong');
});

test('Help passwords: managers all, Team Leaders their departments (Team view on), members none', () => {
  const { passwordsFor } = require('../api/_lib/deletes');
  const conf = { leads: { TC: 'l-tc', DISPO: 'l-di', ACQ: 'l-acq' }, subtasks: { TC: 's-tc', DISPO: 's-di' }, people: { 'brandy@totalchb.com': 'b-own' } };
  const people = { 'brandy@totalchb.com': { name: 'Brandy Pollack', role: 'manager' }, 'monz@totalchb.com': { name: 'Monz', role: 'lead', dept: 'TC', sees: ['TC', 'DISPO'], deptView: true },
    'luke@totalchb.com': { name: 'Luke', role: 'lead', dept: 'ACQ', sees: ['ACQ'], deptView: false }, 'will@totalchb.com': { name: 'Will', role: 'member', dept: 'TC', sees: ['TC'], deptView: true } };
  const managers = ['brandy@totalchb.com', 'systems@totalchb.com'];
  const m = passwordsFor({ me: 'systems@totalchb.com', people, managers, conf });
  assert.deepEqual(m.rows.map(r => r.dept), ['TC', 'DISPO', 'ACQ']);
  assert.deepEqual(m.own, [{ name: 'Brandy Pollack', pw: 'b-own' }]);
  const l = passwordsFor({ me: 'monz@totalchb.com', people, managers, conf });
  assert.deepEqual(l.rows, [{ dept: 'TC', lead: 'l-tc', sub: 's-tc' }, { dept: 'DISPO', lead: 'l-di', sub: 's-di' }]);
  assert.deepEqual(l.own, []);
  assert.deepEqual(passwordsFor({ me: 'luke@totalchb.com', people, managers, conf }).rows, [], 'Team view off: none');
  assert.deepEqual(passwordsFor({ me: 'will@totalchb.com', people, managers, conf }), { rows: [], own: [] }, 'members: none');
});
