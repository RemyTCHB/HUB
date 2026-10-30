// POST /api/title-agent/team: the Title Commitment Agent asks who is on the team (signed with the shared secret, body {}).
// The hub answers with the Managers and the TC department from the team directory: name, email, role, dept, photo.
const { teamFor, verify } = require('../_lib/titleagent');
const { rawBody, team, send } = require('../_lib/hub');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  const body = await rawBody(req), secret = process.env.TITLE_AGENT_SYNC_SECRET;
  if (!secret) return send(res, 503, { error: 'The hub is not set up for the Title Commitment Agent yet.' });
  if (!verify(secret, body, req.headers['x-hub-timestamp'], req.headers['x-hub-signature'])) return send(res, 401, { error: 'Bad signature.' });
  try { JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Not JSON.' }); }
  try {
    const who = await team(), people = teamFor(who.people, who.managers);
    console.log(`title-agent team: ${people.filter(p => p.role === 'manager').length} managers, ${people.filter(p => p.role !== 'manager').length} TC`);
    send(res, 200, { people });
  } catch (e) {
    console.error('title-agent team failed', e);
    send(res, 500, { error: 'The hub could not read the team directory.' });
  }
};
