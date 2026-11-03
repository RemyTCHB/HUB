// POST /api/tc-checklist/delete-check: TC Checklist's server asks whether a person may delete a property, and checks the
// password they typed (api/_lib/tcchecklist.js). Signed with TC_CHECKLIST_SYNC_SECRET.
// Body {"email": "...", "ask": true} → { need: 'confirm' | 'password' } or 403 { error } (members);
// body {"email": "...", "password": "..."} → { ok: true } or 403 { error, wrong: true } / 503 (no password set up).
// TC Checklist checks the person's sign-in first. Passwords are never logged or sent back.
const { verify } = require('../_lib/titleagent');
const { readPasswords } = require('../_lib/deletes');
const { tcDeleteCheck } = require('../_lib/tcchecklist');
const { rawBody, team, personKey, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = process.env.TC_CHECKLIST_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for TC Checklist yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  let ask; try { ask = JSON.parse(body) || {}; } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const email = String(ask.email || '').toLowerCase();
  if (!/^[^@\s]+@totalchb\.com$/.test(email)) return send(res, 400, { error: 'Which person?' });
  try {
    const who = await team(), me = personKey(email);
    const { rule, result } = tcDeleteCheck({ me, people: who.people, managers: who.managers, conf: readPasswords(process.env.HUB_DELETE_PASSWORDS), password: ask.password });
    if (result === 'refused') { console.log('tc-checklist delete: not allowed'); return send(res, 403, { error: rule.refuse }); }
    if (ask.ask) return send(res, 200, { need: rule.need === 'confirm' ? 'confirm' : 'password', own: rule.need === 'person' });
    if (result === 'unset') { console.log('tc-checklist delete: no password set'); return send(res, 503, { error: 'Delete passwords are not set up yet. Ask Remy.' }); }
    if (result === 'wrong') { console.log('tc-checklist delete: wrong password'); return send(res, 403, { error: 'That password is not right.', wrong: true }); }
    console.log('tc-checklist delete: ok');
    send(res, 200, { ok: true });
  } catch (e) {
    console.error('tc-checklist delete-check failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not check the password.' });
  }
};
