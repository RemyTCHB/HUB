// node --test tests/   (the daily digest: whose tasks, what's open, what got done the day before; made-up people)
const test = require('node:test');
const assert = require('node:assert/strict');
const { window, personDigest, digestEmail, isEmpty } = require('../api/_lib/digest');

const NOW = Date.UTC(2026, 10, 23, 13, 5);              // Mon 11/23/2026, 8:05 AM Eastern (EST)
const H = 3600e3, Y = Date.UTC(2026, 10, 22, 5);        // Sun 11/22 midnight Eastern
const people = { 'sam@totalchb.com': { name: 'Sam Test' }, 'lee@totalchb.com': { name: 'Lee Test' } };
const keyOfName = n => Object.keys(people).find(k => people[k].name === n) || '';
const nameOf = k => (people[k] && people[k].name) || k;
const sub = (title, x = {}) => ({ id: title, title, owner: '', status: 'todo', done: false, ...x });
const doneSub = (title, at, x = {}) => sub(title, { status: 'done', done: true, doneAt: at, ...x });
const digest = (tasks, key = 'sam@totalchb.com', now = NOW) => personDigest({ key, tasks, keyOfName, nameOf, now });

test('the window is yesterday, Eastern time, across the clock change', () => {
  const w = window(NOW);
  assert.equal(w.yStart, Y); assert.equal(w.todayStart, Y + 24 * H); assert.equal(w.hour, 8);
  assert.equal(w.today, '2026-11-23'); assert.equal(w.yShort, 'Sun 11/22'); assert.equal(w.yDay, 'Sunday');
  const summer = window(Date.UTC(2026, 6, 14, 12, 30));  // 8:30 AM EDT
  assert.equal(summer.hour, 8); assert.equal(summer.todayStart, Date.UTC(2026, 6, 14, 4));
  const fallBack = window(Date.UTC(2026, 10, 2, 13));     // the Monday after the clocks went back (Sun 11/1)
  assert.equal(fallBack.yStart, Date.UTC(2026, 10, 1, 4)); assert.equal(fallBack.todayStart, Date.UTC(2026, 10, 2, 5));
});

test('their list, plus what they own elsewhere; others\' subtasks and cancelled ones are left out', () => {
  const tasks = [
    { id: 'a', title: 'Own task', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [sub('mine'), sub('for Lee', { owner: 'Lee Test' }), sub('gone', { status: 'cancelled' })] },
    { id: 'b', title: 'Lee\'s task', list: 'lee@totalchb.com', owner: 'Lee Test', subs: [sub('Lee\'s'), sub('Sam\'s part', { owner: 'Sam Test' })] },
    { id: 'c', title: 'MGMT task', list: null, owner: 'Sam Test', subs: [] },
    { id: 'd', title: 'Not Sam\'s', list: null, owner: 'Lee Test', subs: [sub('x')] },
    { id: 'e', title: 'Cancelled', list: 'sam@totalchb.com', owner: 'Sam Test', status: 'cancelled', subs: [] }];
  const d = digest(tasks);
  assert.deepEqual(d.open.map(o => [o.title, o.tag[1], o.items.map(i => i.title)]), [
    ['Own task', 'Your List', ['mine']], ['Lee\'s task', 'Shared by Lee Test', ['Sam\'s part']], ['MGMT task', 'Added by MGMT', []]]);
  assert.equal(d.counts.open, 3);
  assert.deepEqual(digest(tasks, 'lee@totalchb.com').open.map(o => o.title), ['Own task', 'Lee\'s task', 'Not Sam\'s']);
});

test('done yesterday counts only yesterday, with the share of what was open at the start of the day', () => {
  const tasks = [
    { id: 'a', title: 'Deal', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [
      doneSub('yesterday 1', Y + 10 * H), doneSub('yesterday 2', Y + 15 * H), doneSub('the day before', Y - 5 * H),
      doneSub('this morning', Y + 24 * H + H), sub('open'), sub('new today', { createdAt: Y + 24 * H + 2 * H })] },
    { id: 'b', title: 'Small task', list: 'sam@totalchb.com', owner: 'Sam Test', done: true, doneAt: Y + 9 * H, subs: [] },
    { id: 'c', title: 'Finished', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [doneSub('one', Y - H), doneSub('last', Y + 20 * H)] }];
  const d = digest(tasks);
  assert.equal(d.counts.done, 4);                       // 2 + the small task + the last of Finished
  assert.equal(d.counts.startOpen, 5);                  // those 4 + 'open' ('new today' wasn't there yet)
  assert.deepEqual(d.done.map(g => g.title), ['Small task', 'Deal', 'Finished']);
  assert.deepEqual(d.done[1].items.map(i => i.title), ['yesterday 1', 'yesterday 2']);
  assert.deepEqual(d.finished, ['Finished']);
});

test('overdue first, then by due date; due today counted', () => {
  const tasks = [
    { id: 'a', title: 'No date', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [sub('x')] },
    { id: 'b', title: 'Later', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [sub('y', { due: NOW + 4 * 24 * H })] },
    { id: 'c', title: 'Late', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [sub('z', { due: NOW + 3 * H }), sub('w', { due: NOW - 24 * H })] }];
  const d = digest(tasks);
  assert.deepEqual(d.open.map(o => o.title), ['Late', 'Later', 'No date']);
  assert.deepEqual(d.open[0].items.map(i => i.title), ['w', 'z']);
  assert.equal(d.counts.overdue, 1); assert.equal(d.counts.dueToday, 1);
});

test('the email: subject, Still Open before Done, escaped text, nothing to say means no email', () => {
  const tasks = [{ id: 'a', title: 'Deal <b>1</b>', list: 'sam@totalchb.com', owner: 'Sam Test', company: 'kpi',
    subs: [doneSub('called', Y + 10 * H), sub('late', { due: NOW - H })] }];
  const d = digest(tasks), { subject, html } = digestEmail(d, { first: 'Sam', now: NOW });
  assert.equal(subject, 'Your TCHB Digest: 1 Done Yesterday, 1 Open, 1 Overdue (Sun 11/22)');
  assert.ok(html.indexOf('Still Open') < html.indexOf('Done Sunday'), 'Still Open comes first');
  assert.ok(html.includes('Deal &lt;b&gt;1&lt;/b&gt;') && !html.includes('<b>1</b>'));
  assert.ok(html.includes('Good Morning, <span') && html.includes('tchb-logo.png') && html.includes('50%'));
  assert.equal(isEmpty(d), false);
  assert.equal(isEmpty(digest([])), true);
});

test('one email per company: each company\'s tasks, logo and name', () => {
  const tasks = [{ id: 'a', title: 'TCHB deal', list: 'sam@totalchb.com', owner: 'Sam Test', subs: [sub('t1')] },
    { id: 'b', title: 'KPI client', list: 'sam@totalchb.com', owner: 'Sam Test', company: 'kpi', subs: [sub('k1'), doneSub('k0', Y + 9 * H)] }];
  const t = digest(tasks, 'sam@totalchb.com', NOW), tchb = personDigest({ key: 'sam@totalchb.com', tasks, keyOfName, nameOf, now: NOW, company: 'tchb' });
  const kpi = personDigest({ key: 'sam@totalchb.com', tasks, keyOfName, nameOf, now: NOW, company: 'kpi' });
  assert.equal(t.open.length, 2);
  assert.deepEqual(tchb.open.map(o => o.title), ['TCHB deal']); assert.equal(tchb.counts.done, 0);
  assert.deepEqual(kpi.open.map(o => o.title), ['KPI client']); assert.equal(kpi.counts.done, 1);
  const e = digestEmail(kpi, { first: 'Sam', now: NOW, company: 'kpi' });
  assert.equal(e.subject, 'Your KPI DRIVER Digest: 1 Done Yesterday, 1 Open, 0 Overdue (Sun 11/22)');
  assert.ok(e.html.includes('kpi-driver-email.png') && e.html.includes('KPI DRIVER Daily Digest') && !e.html.includes('tchb-logo.png'));
  assert.equal(isEmpty(personDigest({ key: 'lee@totalchb.com', tasks, keyOfName, nameOf, now: NOW, company: 'kpi' })), true);
});
