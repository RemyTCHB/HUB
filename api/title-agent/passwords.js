// POST /api/title-agent/passwords: the Title Commitment Agent's in-app Help asks which delete passwords a person may see.
// Signed like /api/title-agent, with TITLE_AGENT_SYNC_SECRET only (TC Checklist's secret does not open this).
// Body {"email": "..."} (a team-domain address). Answers the same as /api/hub/passwords for that person
// (api/_lib/deletes.js passwordsFor): { rows: [{ dept, lead, sub }], own: [{ name, pw }] }. Logs counts only.
const { verify } = require('../_lib/titleagent');
const { passwordsFor, readPasswords } = require('../_lib/deletes');
const { rawBody, team, personKey, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = process.env.TITLE_AGENT_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for the Title Commitment Agent yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  let ask; try { ask = JSON.parse(body) || {}; } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const email = String((ask && ask.email) || '').trim().toLowerCase();
  if (!/^[^@\s]+@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 400, { error: 'Not a team email.' });
  try {
    const who = await team();
    const out = passwordsFor({ me: personKey(email), people: who.people, managers: who.managers, conf: readPasswords(process.env.HUB_DELETE_PASSWORDS) });
    console.log(`title-agent passwords: ${out.rows.length} departments, ${out.own.length} own`);
    send(res, 200, out);   // send() sets Cache-Control: no-store
  } catch (e) {
    console.error('title-agent passwords failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not load the passwords.' });
  }
};
