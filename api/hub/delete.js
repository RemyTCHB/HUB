// POST /api/hub/delete: the hub page deletes a task or removes a subtask here (with the person's Firebase sign-in).
// The rules and passwords are checked on the server (api/_lib/deletes.js); the Firestore rules don't let the page do
// it any other way. A copy of what was deleted is kept in trash/ (server only), with who and when.
const { deleteRule, passwordCheck, readPasswords } = require('../_lib/deletes');
const { app, db, rawBody, team, personKey, send } = require('../_lib/hub');

const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.email_verified || !/@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 403, { error: 'Not a team account.' });
  let body; try { body = JSON.parse(await rawBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const { kind, list = '', id, sid, password } = body || {};
  if (!['task', 'sub'].includes(kind) || !/^[\w-]{1,80}$/.test(id || '') || (list && !/^[^/\s]{3,200}$/.test(list))
    || (kind === 'sub' && !/^[\w-]{1,80}$/.test(sid || ''))) return send(res, 400, { error: 'Which task?' });
  const me = personKey(email), conf = readPasswords(process.env.HUB_DELETE_PASSWORDS);
  try {
    const who = await team(), name = who.nameOf(me) + (claims.imp ? ' (via ' + who.nameOf(personKey(String(claims.imp).toLowerCase())) + ')' : '');   // Login As User
    const ref = db().doc(list ? `personal/${list}/items/${id}` : `tasks/${id}`);
    const out = await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return { code: 200, body: { ok: true, gone: true } };
      const t = snap.data(), sub = kind === 'sub' ? (t.subs || []).find(s => s.id === sid) : null;
      if (kind === 'sub' && !sub) return { code: 200, body: { ok: true, gone: true } };
      const rule = deleteRule({ me, kind, list, task: t, people: who.people, managers: who.managers, keyOfName: who.keyOfName,
        hasOwnPassword: !!(conf.people || {})[me] });
      if (rule.refuse) return { code: 403, body: { error: rule.refuse }, why: 'not allowed' };
      const pw = passwordCheck(rule, me, password, conf);
      if (pw === 'unset') return { code: 503, body: { error: 'Delete passwords are not set up yet.' }, why: 'no password set' };
      if (pw === 'wrong') return { code: 403, body: { error: 'That password is not right.', wrong: true }, why: 'wrong password' };
      const now = Date.now(), trash = db().collection('trash').doc();
      if (kind === 'task') {
        tx.set(trash, { kind: 'task', path: ref.path, task: t, by: name, byKey: me, at: now });
        tx.delete(ref);
      } else {
        const subs = t.subs.filter(s => s.id !== sid);
        tx.set(trash, { kind: 'subtask', path: ref.path, taskTitle: t.title || '', sub, by: name, byKey: me, at: now });
        const live = subs.filter(s => s.status !== 'cancelled');   // cancelled subtasks don't count (same as the page)
        tx.update(ref, { subs, done: subs.length ? live.length > 0 && live.every(s => s.done) : !!t.done, members: who.members({ ...t, subs }, list),
          updatedBy: name, updatedAt: now, log: [...(t.log || []), { at: now, by: name, ev: 'subtask removed', sid, title: sub.title || '' }].slice(-300) });
      }
      return { code: 200, body: { ok: true } };
    });
    console.log(`hub delete: ${kind}, ${out.why || (out.body.gone ? 'already gone' : 'done')}`);
    if (out.body.wrong) await wait(800);   // slows down guessing
    send(res, out.code, out.body);
  } catch (e) {
    console.error('hub delete failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not delete it. Try again.' });
  }
};
