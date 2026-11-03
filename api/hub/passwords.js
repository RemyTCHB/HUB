// POST /api/hub/passwords: the delete passwords the in-app Help shows the signed-in person (api/_lib/deletes.js
// passwordsFor): managers all, Team Leaders their departments, members none. They come from the HUB_DELETE_PASSWORDS
// setting, so they are never written into the page. Logs counts only.
const { passwordsFor, readPasswords } = require('../_lib/deletes');
const { app, team, personKey, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.email_verified || !/@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 403, { error: 'Not a team account.' });
  try {
    const who = await team(), out = passwordsFor({ me: personKey(email), people: who.people, managers: who.managers, conf: readPasswords(process.env.HUB_DELETE_PASSWORDS) });
    console.log(`hub passwords: ${out.rows.length} departments, ${out.own.length} own`);
    send(res, 200, out);
  } catch (e) {
    console.error('hub passwords failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not load the passwords.' });
  }
};
