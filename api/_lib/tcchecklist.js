// TC Checklist (tc.totalchb.com) uses the hub's delete passwords (owner, 2026-11-03). Its properties belong to the TC
// department, so only the TC Team Leader password and people's own passwords apply. The passwords stay in the
// HUB_DELETE_PASSWORDS setting here: TC Checklist's server asks these endpoints (signed with TC_CHECKLIST_SYNC_SECRET)
// to check a password or to list the ones a person may see; they never go into either app's pages or repositories.
//   - Remy: a confirm, no password.
//   - People with their own delete password (Brandy): that password.
//   - Managers, and Team Leaders who see TC (Team view on): the TC Team Leader password.
//   - Members (and anyone not in the team directory): can't delete; they mark the property Cancelled instead.
const { ADMIN, passwordCheck } = require('./deletes');

const DEPT = 'TC';

/** { need: 'confirm' | 'person' | 'lead', dept } or { refuse: '<why>' } */
function tcDeleteRule({ me, people, managers, hasOwnPassword }) {
  const mine = people[me] || {};
  if (me === ADMIN) return { need: 'confirm' };
  if (hasOwnPassword) return { need: 'person' };
  if (managers.includes(me)) return { need: 'lead', dept: DEPT };
  if (mine.role === 'lead' && mine.deptView === true && (mine.sees || []).includes(DEPT)) return { need: 'lead', dept: DEPT };
  return { refuse: 'Only Team Leaders and Managers can delete a property. Mark it Cancelled instead.' };
}

/** 'ok' | 'wrong' | 'unset' | the refusal */
function tcDeleteCheck({ me, people, managers, conf, password }) {
  const rule = tcDeleteRule({ me, people, managers, hasOwnPassword: !!(conf.people || {})[me] });
  if (rule.refuse) return { rule, result: 'refused' };
  return { rule, result: passwordCheck(rule, me, password, conf) };
}

/** The passwords TC Checklist's Help shows a person: managers the TC Team Leader password and anyone's own; a Team
 *  Leader who sees TC the TC password (and their own, if they have one); members none.
 *  { rows: [{ dept, lead }], own: [{ name, pw }], confirmOnly } */
function tcPasswordsFor({ me, people, managers, conf }) {
  const mine = people[me] || {}, isM = managers.includes(me), lead = (conf.leads || {})[DEPT] || '';
  const seesTc = isM || (mine.role === 'lead' && mine.deptView === true && (mine.sees || []).includes(DEPT));
  const rows = seesTc && lead ? [{ dept: DEPT, lead }] : [];
  const ownAll = Object.entries(conf.people || {}).map(([k, pw]) => ({ key: k, name: (people[k] && people[k].name) || k, pw }));
  const own = (isM ? ownAll : ownAll.filter(o => o.key === me)).map(({ name, pw }) => ({ name, pw }));
  return { rows, own, confirmOnly: me === ADMIN };
}

module.exports = { tcDeleteRule, tcDeleteCheck, tcPasswordsFor };
