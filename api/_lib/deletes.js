// Who may delete a task or remove a subtask, and with which password (owner's rules, 2026-11-02). The page asks
// for the password; POST /api/hub/delete checks it here, so the passwords never reach the page or the repository.
//   - Remy: a confirm, no password.
//   - People with their own delete password (Brandy): that password, for tasks and subtasks.
//   - Tasks in your own personal list: you delete them yourself in the page, as before (no password).
//   - Other tasks: Team Leaders who see the task's department, and other managers, with that department's
//     Team Leader password.
//   - Subtasks: anyone who can work on the task, with the task's department subtask password.
//   - MGMT tasks and their subtasks (no department): managers only (a confirm).
// Passwords come from the HUB_DELETE_PASSWORDS setting (Vercel), JSON:
//   { "leads": { "TC": "…", … }, "subtasks": { "TC": "…", … }, "people": { "brandy@totalchb.com": "…" } }
const crypto = require('crypto');

const ADMIN = 'systems@totalchb.com';

/** What deleting needs: { need: 'confirm' | 'person' | 'lead' | 'sub', dept } or { refuse: '<why>' }.
 *  ctx: { me, kind: 'task' | 'sub', list (the list owner's key; '' for MGMT), task, people, managers, keyOfName,
 *  hasOwnPassword } */
function deleteRule({ me, kind, list, task, people, managers, keyOfName, hasOwnPassword }) {
  const isM = k => managers.includes(k), rec = k => people[k] || {}, mine = rec(me);
  const deptOf = k => isM(k) ? '' : rec(k).dept || '';
  const seesDept = d => !!d && mine.deptView === true && (mine.sees || []).includes(d);
  const onTask = (task.members || []).some(m => m === 'tchb:' + me || m === 'kpi:' + me);
  const mgmt = !list, dept = mgmt ? '' : deptOf(list);
  const full = mgmt ? isM(me) : list === me || (isM(me) && !isM(list)) || seesDept(dept);
  if (!full && !onTask) return { refuse: 'You can\'t see this task.' };
  if (me === ADMIN) return { need: 'confirm' };
  if (kind === 'task') {
    if (!mgmt && list === me) return { need: 'confirm' };
    if (hasOwnPassword) return full ? { need: 'person' } : { refuse: 'Only Team Leaders can delete tasks.' };
    if (mgmt) return isM(me) ? { need: 'confirm' } : { refuse: 'Only managers can delete MGMT tasks.' };
    if (isM(me)) return dept ? { need: 'lead', dept } : { refuse: 'Only Remy or Brandy can delete this task.' };
    if (mine.role === 'lead' && seesDept(dept)) return { need: 'lead', dept };
    return { refuse: 'Only Team Leaders can delete tasks.' };
  }
  // A subtask. Someone who only shares the task can remove its subtasks only when the whole task is theirs.
  if (!full && keyOfName(task.owner) !== me) return { refuse: 'Only the task\'s owner can remove its subtasks.' };
  if (hasOwnPassword) return { need: 'person' };
  if (mgmt) return isM(me) ? { need: 'confirm' } : { refuse: 'Only managers can remove subtasks from MGMT tasks.' };
  if (dept) return { need: 'sub', dept };
  return isM(me) ? { need: 'confirm' } : { refuse: 'Only managers can remove subtasks here.' };
}

const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());

/** 'ok', 'wrong', or 'unset' (no password is set up for this). */
function passwordCheck(rule, me, given, conf) {
  if (rule.need === 'confirm') return 'ok';
  const want = rule.need === 'person' ? (conf.people || {})[me] : rule.need === 'lead' ? (conf.leads || {})[rule.dept] : (conf.subtasks || {})[rule.dept];
  if (!want) return 'unset';
  return given && same(given, want) ? 'ok' : 'wrong';
}

function readPasswords(raw) {
  try { const c = JSON.parse(raw || '{}'); return c && typeof c === 'object' ? c : {}; } catch (e) { return {}; }
}

module.exports = { ADMIN, deleteRule, passwordCheck, readPasswords };
