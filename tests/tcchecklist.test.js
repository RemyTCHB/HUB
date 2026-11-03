// node --test tests/tcchecklist.test.js   (TC Checklist: who may delete a property, and which passwords its Help shows)
const test = require('node:test'), assert = require('node:assert');
const { tcDeleteRule, tcDeleteCheck, tcPasswordsFor } = require('../api/_lib/tcchecklist');
const { readPasswords } = require('../api/_lib/deletes');

const people = {
  'systems@totalchb.com': { name: 'Remy' }, 'brandy@totalchb.com': { name: 'Brandy' }, 'boss@totalchb.com': { name: 'Bo' },
  'lead@totalchb.com': { name: 'Tia Lead', role: 'lead', dept: 'TC', sees: ['TC'], deptView: true },
  'off@totalchb.com': { name: 'Off Lead', role: 'lead', dept: 'TC', sees: ['TC'], deptView: false },
  'dee@totalchb.com': { name: 'Dee', role: 'lead', dept: 'DISPO', sees: ['DISPO'], deptView: true },
  'carlos@totalchb.com': { name: 'Carlos', role: 'lead', dept: 'DISPO', sees: ['TC', 'DISPO'], deptView: true },
  'monz@totalchb.com': { name: 'Monz', role: 'member', dept: 'TC', sees: ['TC'], deptView: true } };
const managers = ['brandy@totalchb.com', 'systems@totalchb.com', 'boss@totalchb.com'];
const conf = readPasswords(JSON.stringify({ leads: { TC: 'tl-tc', DISPO: 'tl-dispo' }, subtasks: { TC: 'sub-tc' }, people: { 'brandy@totalchb.com': 'b-pw' } }));
const rule = me => tcDeleteRule({ me, people, managers, hasOwnPassword: !!(conf.people || {})[me] });
const check = (me, password) => tcDeleteCheck({ me, people, managers, conf, password }).result;

test('who may delete a property, and with which password', () => {
  assert.deepEqual(rule('systems@totalchb.com'), { need: 'confirm' });
  assert.deepEqual(rule('brandy@totalchb.com'), { need: 'person' });
  assert.deepEqual(rule('boss@totalchb.com'), { need: 'lead', dept: 'TC' });
  assert.deepEqual(rule('lead@totalchb.com'), { need: 'lead', dept: 'TC' });
  assert.deepEqual(rule('carlos@totalchb.com'), { need: 'lead', dept: 'TC' }, 'a Dispo lead who sees TC');
  for (const me of ['monz@totalchb.com', 'off@totalchb.com', 'dee@totalchb.com', 'stranger@totalchb.com']) assert.ok(rule(me).refuse, me);
});

test('passwords are checked: the TC one only, own passwords for their owner', () => {
  assert.equal(check('systems@totalchb.com'), 'ok');
  assert.equal(check('lead@totalchb.com', 'tl-tc'), 'ok');
  assert.equal(check('lead@totalchb.com', 'tl-dispo'), 'wrong', 'another department\'s password');
  assert.equal(check('lead@totalchb.com', 'sub-tc'), 'wrong', 'the subtask password');
  assert.equal(check('lead@totalchb.com', ''), 'wrong');
  assert.equal(check('brandy@totalchb.com', 'b-pw'), 'ok');
  assert.equal(check('brandy@totalchb.com', 'tl-tc'), 'wrong');
  assert.equal(check('monz@totalchb.com', 'tl-tc'), 'refused');
  assert.equal(tcDeleteCheck({ me: 'boss@totalchb.com', people, managers, conf: {}, password: 'x' }).result, 'unset');
});

test('Help shows managers the TC password and everyone\'s own; TC leads the TC one; members nothing', () => {
  const pw = me => tcPasswordsFor({ me, people, managers, conf });
  assert.deepEqual(pw('boss@totalchb.com'), { rows: [{ dept: 'TC', lead: 'tl-tc' }], own: [{ name: 'Brandy', pw: 'b-pw' }], confirmOnly: false });
  assert.equal(pw('systems@totalchb.com').confirmOnly, true);
  assert.deepEqual(pw('lead@totalchb.com'), { rows: [{ dept: 'TC', lead: 'tl-tc' }], own: [], confirmOnly: false });
  assert.deepEqual(pw('carlos@totalchb.com').rows, [{ dept: 'TC', lead: 'tl-tc' }]);
  for (const me of ['monz@totalchb.com', 'dee@totalchb.com', 'off@totalchb.com']) assert.deepEqual(pw(me), { rows: [], own: [], confirmOnly: false }, me);
  assert.ok(!JSON.stringify(pw('boss@totalchb.com')).includes('tl-dispo'), 'other departments never shown');
});
