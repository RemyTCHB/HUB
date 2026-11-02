// POST /api/hub/login-as: Remy signs in as a team member to check their view (Team Members → Login As User), and
// { back: true } from that borrowed sign-in returns him to his own account without Google (Back To Remy).
// Only Remy, never from a borrowed sign-in. The hub signs them in with a one-time Firebase sign-in for that person
// (a custom token marked imp: Remy's email), so they see and change exactly what that person can. Each use is kept in
// audit/ (server only). Logs counts only.
const { app, db, rawBody, personKey, send } = require('../_lib/hub');

const ADMIN = 'systems@totalchb.com';
const ALIASES = { 'brandy@totalchb.com': ['brandy@kpidriver.com'], 'systems@totalchb.com': ['systems@kpidriver.com'] };

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  let body; try { body = JSON.parse(await rawBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  // Back To Remy: only a sign-in Remy started (it carries imp: his email) can take him back to his own account.
  if (body && body.back === true) {
    const imp = String(claims.imp || '').toLowerCase();
    if (!imp || personKey(imp) !== ADMIN) return send(res, 403, { error: 'Not a Login As session.' });
    try {
      const remy = await app().auth().getUserByEmail(imp);
      const token = await app().auth().createCustomToken(remy.uid);
      await db().collection('audit').add({ kind: 'back to remy', by: ADMIN, from: personKey(email), at: Date.now() });
      console.log('hub login-as: back');
      return send(res, 200, { token });
    } catch (e) {
      console.error('hub login-as back failed', e.code || '', e.message || '');
      return send(res, 500, { error: 'Could not switch back. Sign in with Google.' });
    }
  }
  if (!claims.email_verified || personKey(email) !== ADMIN || claims.imp) return send(res, 403, { error: 'Only Remy can do this.' });
  const target = String((body && body.email) || '').trim().toLowerCase();
  if (!/^[^@\s/]+@(totalchb|kpidriver)\.com$/.test(target) || personKey(target) === ADMIN) return send(res, 400, { error: 'Which team member?' });
  try {
    let user = null;
    for (const e of [target, ...(ALIASES[target] || [])]) { try { user = await app().auth().getUserByEmail(e); break; } catch (err) { if (err.code !== 'auth/user-not-found') throw err; } }
    if (!user) return send(res, 404, { error: 'They have not signed in to the hub yet, so there is no account to open.' });
    if (user.disabled) return send(res, 403, { error: 'That account is turned off.' });
    const token = await app().auth().createCustomToken(user.uid, { imp: email });
    await db().collection('audit').add({ kind: 'login as', by: ADMIN, as: personKey(target), at: Date.now() });
    console.log('hub login-as: ok');
    send(res, 200, { token });
  } catch (e) {
    console.error('hub login-as failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not sign in as them. Try again.' });
  }
};
