// POST /api/hooks/ghl?key=<GHL_WEBHOOK_KEY>: a GHL CRM workflow deploys a saved task list into someone's list.
// Default: Monz's "TC Deal Tasks", named TC - <address1>, <city> <state> <postal_code>. One task per contact: a
// repeat for the same contact does nothing. Vercel settings: GHL_WEBHOOK_KEY (required); GHL_DEPLOY_FOR and
// GHL_TEMPLATE to deploy another person's list or another template. Logs counts only.
const { listsOf, buildTask, ghlAddress, ghlContact, same, hash } = require('../_lib/templates');
const { db, rawBody, team, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const want = process.env.GHL_WEBHOOK_KEY;
  if (!want) return send(res, 503, { error: 'The hub is not set up for GHL yet.' });
  const url = new URL(req.url, 'http://hub'), given = url.searchParams.get('key') || req.headers['x-hub-key'] || '';
  if (!given || !same(given, want)) return send(res, 401, { error: 'Bad key.' });
  let body; try { body = JSON.parse(await rawBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const address = ghlAddress(body);
  if (!address) return send(res, 400, { error: 'No address on this contact (address1).' });
  const forKey = (process.env.GHL_DEPLOY_FOR || 'monz@totalchb.com').toLowerCase(), tplName = process.env.GHL_TEMPLATE || 'TC Deal Tasks';
  try {
    const who = await team(), name = who.nameOf(forKey);
    const tpl = listsOf((await db().doc('templates/' + forKey).get()).data(), forKey).find(l => (l.name || '').toLowerCase() === tplName.toLowerCase());
    if (!tpl) { console.error('ghl deploy: template not found'); return send(res, 404, { error: 'Template "' + tplName + '" not found.' }); }
    const contact = ghlContact(body), key = 'ghl-' + (contact || hash(address)) + '-' + hash(tpl.name).slice(0, 8);
    const linkRef = db().doc('hubsync/' + key), ref = db().doc(`personal/${forKey}/items/${key}`);
    const out = await db().runTransaction(async tx => {
      const link = await tx.get(linkRef);
      if (link.exists) return { skipped: true };
      const now = Date.now(), task = buildTask({ id: key, title: 'TC - ' + address, owner: name, subOwner: name, by: 'GHL CRM', now,
        subs: (tpl.subs || []).map(t => ({ title: t })), extra: { deployed: [tpl.name], members: [] } });
      task.members = who.members(task, forKey);
      tx.set(ref, task);
      tx.set(linkRef, { kind: 'ghl', path: ref.path, template: tpl.name, created: true, at: now });
      return { created: true, subs: task.subs.length };
    });
    console.log(`ghl deploy: ${out.skipped ? 'repeat skipped' : 'created, ' + out.subs + ' subtasks'}`);
    send(res, 200, { ok: true, ...out });
  } catch (e) {
    console.error('ghl deploy failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not create the task. Try again.' });
  }
};
