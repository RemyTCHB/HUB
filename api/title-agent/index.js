// POST /api/title-agent: the Title Commitment Agent sends one deal's Closing Blockers (signed with the shared secret).
// The hub creates or updates the deal's task in the owner's list and answers with any blockers that were ticked or
// unticked in the hub, so the agent can copy them over.
const { applyDeal, verify, AGENT } = require('../_lib/titleagent');
const { db, rawBody, team, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = process.env.TITLE_AGENT_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for the Title Commitment Agent yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  let payload; try { payload = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const dealId = payload && payload.deal && payload.deal.id;
  if (!dealId || !/^[\w-]{1,40}$/.test(String(dealId)) || !Array.isArray(payload.blockers)) return send(res, 400, { error: 'Missing deal or blockers.' });
  try {
    const who = await team(), ownerKey = (process.env.HUB_TITLE_OWNER || 'monz@totalchb.com').toLowerCase();
    const owner = { key: ownerKey, name: who.nameOf(ownerKey) === ownerKey ? 'Monz Miller' : who.nameOf(ownerKey) };
    const linkRef = db().doc('hubsync/title-agent-' + dealId);
    const out = await db().runTransaction(async tx => {
      const link = await tx.get(linkRef), l = link.exists ? link.data() : null;
      const ref = db().doc(l && l.path ? l.path : `personal/${owner.key}/items/ta-${dealId}`), snap = await tx.get(ref);
      const r = applyDeal(snap.exists ? snap.data() : null, l, { ...payload, complete: true }, { now: Date.now(), owner, company: 'tchb' });
      if (r.task) tx.set(ref, { ...r.task, members: who.members(r.task, ref.parent.parent.id) });
      if (r.created || r.task) tx.set(linkRef, { deal: dealId, path: ref.path, created: true, syncedAt: Date.now() }, { merge: true });
      return { task: r.task || (snap.exists ? snap.data() : null), created: r.created, changed: r.changed, updates: r.updates, skipped: r.skipped, path: ref.path };
    });
    console.log(`title-agent sync: deal ${dealId}, ${payload.blockers.length} blockers, ${out.created ? 'created' : out.changed ? 'updated' : 'no change'}, ${out.updates.length} back`);
    send(res, 200, { ok: true, task: out.task ? out.task.id : null, created: out.created, changed: out.changed, skipped: out.skipped || null, updates: out.updates, by: AGENT });
  } catch (e) {
    console.error('title-agent sync failed', e);
    send(res, 500, { error: 'The hub could not save this deal. It will be tried again.' });
  }
};
