// POST /api/hub/upload: Upload Tasks. The page reads the CSV with an upload template (e.g. SOW for TC), saves the
// file to the task's folder, and sends the rows here (with the person's Firebase sign-in). The task goes in the
// department Team Leader's list (owner: the Team Leader; subtasks: the person who uploaded), tagged CSV Upload <name>.
const { UPLOADS, LIMITS, clip, buildTask, leadOf } = require('../_lib/templates');
const { app, db, rawBody, team, personKey, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  let claims;
  try { claims = await app().auth().verifyIdToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')); }
  catch (e) { return send(res, 401, { error: 'Sign in again.' }); }
  const email = String(claims.email || '').toLowerCase();
  if (!claims.email_verified || !/@(totalchb|kpidriver)\.com$/.test(email)) return send(res, 403, { error: 'Not a team account.' });
  let body; try { body = JSON.parse(await rawBody(req) || '{}'); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  const { template, address, id, subs, file } = body || {}, tpl = UPLOADS[template];
  if (!tpl) return send(res, 400, { error: 'Which upload template?' });
  const addr = clip(address, LIMITS.address);
  if (!addr) return send(res, 400, { error: 'Add the address.' });
  if (!/^csv-[a-z0-9]{6,40}$/.test(id || '')) return send(res, 400, { error: 'Which task?' });
  const rows = Array.isArray(subs) ? subs.filter(s => s && clip(s.title, LIMITS.title)) : [];
  if (!rows.length) return send(res, 400, { error: 'No subtasks found in the file.' });
  if (rows.length > LIMITS.subs) return send(res, 400, { error: 'Too many rows (up to ' + LIMITS.subs + ').' });
  const emu = process.env.FIREBASE_STORAGE_EMULATOR_HOST;   // local tests only
  const okFile = file && typeof file.url === 'string' && (/^https:\/\/firebasestorage\.googleapis\.com\//.test(file.url) || (!!emu && file.url.startsWith('http://' + emu + '/')))
    && typeof file.path === 'string' && file.path.startsWith(`files/tchb/${id}/`);
  const me = personKey(email);
  try {
    const who = await team(), rec = who.people[me] || {};
    const inDept = who.managers.includes(me) || rec.dept === tpl.dept || (rec.sees || []).includes(tpl.dept);
    if (!inDept) return send(res, 403, { error: 'This upload is for the ' + tpl.dept + ' department.' });
    const lead = leadOf(who.people, who.managers, tpl.dept) || me, name = who.nameOf(me), now = Date.now();
    const by = name + (claims.imp ? ' (via ' + who.nameOf(personKey(String(claims.imp).toLowerCase())) + ')' : '');   // Login As User
    const ref = db().doc(`personal/${lead}/items/${id}`);
    const task = buildTask({ id, title: tpl.title(addr), owner: who.nameOf(lead), subOwner: name, by, now,
      subs: rows.map(r => ({ title: r.title, note: typeof r.note === 'string' ? r.note : '' })),
      extra: { upload: { template: template, by, at: now },
        files: okFile ? [{ id: 'f' + id.slice(4), name: clip(file.name || 'upload.csv', 200), size: Number(file.size) || 0, type: 'text/csv', url: file.url, path: file.path, by, at: now }] : [] } });
    task.members = who.members(task, lead);
    await db().runTransaction(async tx => { if ((await tx.get(ref)).exists) throw Object.assign(new Error('exists'), { code: 'exists' }); tx.set(ref, task); });
    console.log(`hub upload: ${template}, ${task.subs.length} subtasks${okFile ? ', file kept' : ''}`);
    send(res, 200, { ok: true, title: task.title, lead: who.nameOf(lead), subs: task.subs.length });
  } catch (e) {
    if (e.code === 'exists') return send(res, 409, { error: 'That upload was already saved.' });
    console.error('hub upload failed', e.code || '', e.message || '');
    send(res, 500, { error: 'Could not create the task. Try again.' });
  }
};
