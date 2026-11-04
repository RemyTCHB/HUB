// POST /api/tc-checklist/passwords: TC Checklist's server asks which delete passwords a signed-in person may see in its
// Help (api/_lib/tcchecklist.js tcPasswordsFor). Signed with TC_CHECKLIST_SYNC_SECRET (or TC_CHECKLIST_SECRET); body {"email": "..."}.
// TC Checklist checks the person's sign-in before asking. Logs counts only.
const { verify } = require('../_lib/titleagent');
const { readPasswords } = require('../_lib/deletes');
const { tcPasswordsFor, tcSecret } = require('../_lib/tcchecklist');
const { rawBody, team, personKey, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = tcSecret();
  if (!secret) return send(res, 503, { error: 'The hub is not set up for TC Checklist yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  let ask; try { ask = JSON.parse(body) || {}; } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const email = String(ask.email || '').toLowerCase();
  if (!/^[^@\s]+@totalchb\.com$/.test(email)) return send(res, 400, { error: 'Which person?' });
  try {
    const who = await team(), out = tcPasswordsFor({ me: personKey(email), people: who.people, managers: who.managers, conf: readPasswords(process.env.HUB_DELETE_PASSWORDS) });
    console.log(`tc-checklist passwords: ${out.rows.length} departments, ${out.own.length} own`);
    send(res, 200, out);
  } catch (e) {
    console.error('tc-checklist passwords failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not load the passwords.' });
  }
};
