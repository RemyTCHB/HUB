// Server side of the hub (Vercel functions): Firebase Admin for the hub project, the team directory, and reading a
// request's raw body (signatures are checked against the exact bytes).
const admin = require('firebase-admin');

const ROOT_MANAGERS = ['brandy@totalchb.com', 'systems@totalchb.com'];     // keep in step with the app and the rules
const SAME_PERSON = { 'brandy@kpidriver.com': 'brandy@totalchb.com', 'systems@kpidriver.com': 'systems@totalchb.com' };
const personKey = email => SAME_PERSON[email] || email;

function app() {
  if (!admin.apps.length) {
    const raw = process.env.HUB_FIREBASE_SERVICE_ACCOUNT;               // the service account key's JSON (Vercel setting)
    admin.initializeApp(raw ? { credential: admin.credential.cert(JSON.parse(raw)) } : { projectId: process.env.GCLOUD_PROJECT || 'universal-task-tracker' });
  }
  return admin;
}
const db = () => app().firestore();

async function rawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  const chunks = []; for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// Who is who: names, managers and company access, as the app reads them.
async function team() {
  const [d, m] = await Promise.all([db().doc('meta/directory').get(), db().doc('meta/managers').get()]);
  const people = (d.exists && d.data().people) || {}, managers = [...ROOT_MANAGERS, ...((m.exists && m.data().keys) || [])];
  const keyOfName = n => { n = (n || '').trim().toLowerCase(); return Object.keys(people).find(k => (people[k].name || '').trim().toLowerCase() === n) || ''; };
  return { people, managers, keyOfName, nameOf: k => (people[k] && people[k].name) || k,
    // '<company>:<login>' for everyone else who owns part of the task (the app's membersOf)
    members: (t, list) => [...new Set([t.owner, ...(t.subs || []).map(s => s.owner)].map(keyOfName)
      .filter(k => k && k !== list && !managers.includes(k)).map(k => (t.company || 'tchb') + ':' + k))].sort() };
}

const send = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(body)); };

module.exports = { app, db, rawBody, team, personKey, send };
