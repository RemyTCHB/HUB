// node --test tests/templates.test.js   (saved task lists, CSV upload templates, the GHL webhook's address)
const test = require('node:test'), assert = require('node:assert');
const { STARTER, UPLOADS, listsOf, leadOf, buildTask, ghlAddress, ghlContact } = require('../api/_lib/templates');

test('Monz starts with TC Deal Tasks, Wholesale and Novation (Novation split into its own lines)', () => {
  const l = listsOf(null, 'monz@totalchb.com');
  assert.deepEqual(l.map(x => [x.name, x.subs.length]), [['TC Deal Tasks', 4], ['Wholesale', 7], ['Novation', 10]]);
  assert.deepEqual(listsOf({ lists: [{ id: 'a', name: 'Mine', subs: ['x'] }] }, 'monz@totalchb.com').map(x => x.name), ['Mine'], 'her saved lists win');
  assert.deepEqual(listsOf(null, 'will@totalchb.com'), []);
  assert.equal(STARTER['monz@totalchb.com'][2].subs.includes('Follow up on title search'), true);
});

test('the SOW upload is a TC template named SOW - <address>; its owner is the TC Team Leader', () => {
  assert.equal(UPLOADS.SOW.dept, 'TC'); assert.equal(UPLOADS.SOW.title('12 Oak St'), 'SOW - 12 Oak St');
  const people = { 'monz@totalchb.com': { role: 'lead', dept: 'TC', order: 3 }, 'z@totalchb.com': { role: 'lead', dept: 'TC', order: 9 },
    'carlos@totalchb.com': { role: 'lead', dept: 'DISPO', sees: ['TC', 'DISPO'], order: 1 }, 'will@totalchb.com': { role: 'member', dept: 'TC', order: 2 } };
  assert.equal(leadOf(people, [], 'TC'), 'monz@totalchb.com');
  assert.equal(leadOf(people, [], 'OPS'), '');
});

test('a built task has the subtasks, one note per row, the log and dates', () => {
  const t = buildTask({ id: 'csv-abc123', title: 'SOW - 12 Oak St', owner: 'Monz Miller', subOwner: 'Will Robbinson', by: 'Will Robbinson', now: 5,
    subs: [{ title: 'Roof', note: 'Cost: 1,200\nNotes: Replace' }, { title: 'Paint', note: '' }], extra: { upload: { template: 'SOW' } } });
  assert.equal(t.owner, 'Monz Miller'); assert.deepEqual(t.subs.map(s => [s.title, s.owner, (s.notes || []).length]), [['Roof', 'Will Robbinson', 1], ['Paint', 'Will Robbinson', 0]]);
  assert.equal(t.subs[0].notes[0].text, 'Cost: 1,200\nNotes: Replace');
  assert.equal(t.log[0].ev, 'created'); assert.equal(t.upload.template, 'SOW'); assert.equal(t.createdAt, 5);
});

test('GHL: TC - <address1>, <city> <state> <postal_code>, from the body, customData or contact', () => {
  assert.equal(ghlAddress({ address1: '12 Oak St', city: 'Akron', state: 'OH', postal_code: '44301' }), '12 Oak St, Akron OH 44301');
  assert.equal(ghlAddress({ customData: { address1: '9 Elm Rd', city: 'Kent', state: 'OH', postal_code: '44240' } }), '9 Elm Rd, Kent OH 44240');
  assert.equal(ghlAddress({ contact: { address1: '1 A St', city: '', state: 'OH' } }), '1 A St, OH');
  assert.equal(ghlAddress({ city: 'Akron' }), '', 'no street, no task');
  assert.equal(ghlContact({ contact_id: 'abc/12 3' }), 'abc123');
  assert.equal(ghlContact({ contact: { id: 'xyz' } }), 'xyz');
});
