// POST /api/dispo-ops: DISPO OPS sends one deal's progress (signed with DISPO_OPS_SYNC_SECRET, the same scheme as the
// Title Commitment Agent). The hub creates or updates "DISPO - <address>" in the DISPO owner's list. One way: nothing
// is sent back. DISPO OPS keeps this switched off until its owner decides what moves (HUB_SYNC_ENABLED there).
const { applyDispo, APP } = require('../_lib/dispoops');
const { verify } = require('../_lib/titleagent');
const { db, rawBody, team, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = process.env.DISPO_OPS_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for DISPO OPS yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  let payload; try { payload = JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const dealId = payload && payload.deal && payload.deal.id;
  if (!dealId || !/^[\w-]{1,60}$/.test(String(dealId))) return send(res, 400, { error: 'Missing deal.' });
  try {
    const who = await team(), ownerKey = (process.env.HUB_DISPO_OWNER || 'carlos@totalchb.com').toLowerCase();
    const owner = { key: ownerKey, name: who.nameOf(ownerKey) === ownerKey ? 'Carlos Caballero' : who.nameOf(ownerKey) };
    const linkRef = db().doc('hubsync/dispo-ops-' + dealId);
    const out = await db().runTransaction(async tx => {
      const link = await tx.get(linkRef), l = link.exists ? link.data() : null;
      const ref = db().doc(l && l.path ? l.path : `personal/${owner.key}/items/do-${dealId}`), snap = await tx.get(ref);
      const r = applyDispo(snap.exists ? snap.data() : null, l, payload, { now: Date.now(), owner, people: who.people });
      if (r.task) tx.set(ref, { ...r.task, members: who.members(r.task, ref.parent.parent.id) });
      if (r.created || r.task || r.removed) tx.set(linkRef, { deal: dealId, path: ref.path, created: true, ...(r.removed ? { removed: true } : {}), syncedAt: Date.now() }, { merge: true });
      return { created: r.created, changed: r.changed, skipped: r.skipped, task: r.task ? r.task.id : (snap.exists ? snap.id : null) };
    });
    console.log(`dispo-ops sync: ${(payload.phases || []).length} phases, ${out.created ? 'created' : out.changed ? 'updated' : out.skipped ? 'skipped' : 'no change'}`);
    send(res, 200, { ok: true, task: out.task, created: out.created, changed: out.changed, skipped: out.skipped || null, by: APP });
  } catch (e) {
    console.error('dispo-ops sync failed', e);
    send(res, 500, { error: 'The hub could not save this deal. It will be tried again.' });
  }
};
