// POST /api/title-agent/hub: the hub page calls this after saving a task from the Title Commitment Agent (with the
// person's Firebase sign-in). It reads the task as saved and sends the agent every blocker ticked or unticked here.
const { hubChanges, sign, AGENT } = require('../_lib/titleagent');
const { app, db, rawBody, team, personKey, send } = require('../_lib/hub');

const ENGINE = () => (process.env.TITLE_AGENT_ENGINE_URL || 'https://title-agent-engine-622792668017.us-east1.run.app').replace(/\/$/, '');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const secret = process.env.TITLE_AGENT_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for the Title Commitment Agent yet.' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.email_verified || !/@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 403, { error: 'Not a team account.' });
  let body; try { body = JSON.parse(await rawBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const { list, id } = body;
  if (!/^[^/]{3,200}$/.test(list || '') || !/^ta-[\w-]{1,40}$/.test(id || '')) return send(res, 400, { error: 'Which task?' });
  try {
    const ref = db().doc(`personal/${list}/items/${id}`), snap = await ref.get();
    if (!snap.exists || snap.data().source !== AGENT || !snap.data().ext) return send(res, 404, { error: 'Not a Title Commitment Agent task.' });
    const task = snap.data(), updates = hubChanges(task);
    if (!updates.length) return send(res, 200, { ok: true, sent: 0 });
    const who = await team(), name = who.nameOf(personKey(email));
    const out = JSON.stringify({ deal_id: task.ext.deal, updates: updates.map(u => ({ ...u, by: name })) });
    const r = await fetch(ENGINE() + '/v1/hub/items', { method: 'POST', headers: { 'Content-Type': 'application/json', ...sign(secret, out) }, body: out });
    if (!r.ok) { console.error('title agent refused', r.status, (await r.text()).slice(0, 200)); return send(res, 502, { error: 'The Title Commitment Agent did not take the change; it will be tried again.' }); }
    // Remember what the agent now has, so the next sync doesn't send it again.
    await db().runTransaction(async tx => {
      const cur = await tx.get(ref); if (!cur.exists) return;
      const t = cur.data(), sent = new Map(updates.map(u => [u.key, u.status]));
      tx.update(ref, { subs: (t.subs || []).map(s => s.ext && sent.has(s.ext.key) ? { ...s, ext: { ...s.ext, status: sent.get(s.ext.key) } } : s) });
    });
    console.log(`title-agent hub change: deal ${task.ext.deal}, ${updates.length} sent`);
    send(res, 200, { ok: true, sent: updates.length });
  } catch (e) {
    console.error('title-agent hub change failed', e);
    send(res, 500, { error: 'Could not reach the Title Commitment Agent; it will be tried again.' });
  }
};
