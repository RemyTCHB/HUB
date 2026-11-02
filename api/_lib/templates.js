// Task templates on the server: the saved task lists people deploy (templates/<login>), the CSV upload templates
// (Upload Tasks), and the GHL webhook that deploys a list. Keep STARTER and UPLOADS in step with STARTER_TEMPLATES and
// UPLOAD_TEMPLATES in app/app.dc.html.
const crypto = require('crypto');

// Monz's lists until she saves her own (owner, 2026-11-02).
const STARTER = {
  'monz@totalchb.com': [
    { id: 'tc-deal-tasks', name: 'TC Deal Tasks', subs: ['Do seller call and fill TC checklist', 'Understand occupancy of property',
      'TC assistant search for a runner', 'I set up time for runner to meet the seller'] },
    { id: 'wholesale', name: 'Wholesale', subs: ['If owner occupied schedule showings with seller', 'After we have a buyer submit to title',
      'Follow up on title search', 'Keep in contact with the seller and update on next steps', 'Solve any closing blockers',
      'Schedule closing with title, buyer and seller', 'TC assistant sends review link'] },
    { id: 'novation', name: 'Novation', subs: ['If owner occupied schedule showings with seller', 'After we have a buyer submit to title',
      'Follow up on title search', 'After getting a buyer schedule appraisals and inspections',
      'TC assistant gets contractors for any fixes requested', 'Follow up with agents to make sure everything is cleared to close on buyer side',
      'Keep in contact with the seller and update on next steps', 'Solve any closing blockers',
      'Schedule closing with title, buyer and seller', 'TC assistant sends review link'] }
  ]
};

// CSV upload templates, by department. The page reads the file; the server builds the task.
const UPLOADS = {
  SOW: { dept: 'TC', name: 'SOW', title: address => 'SOW - ' + address }
};

const LIMITS = { subs: 500, title: 300, note: 2000, address: 200, name: 200 };
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
const newId = prefix => prefix + '-' + crypto.randomBytes(6).toString('hex');

/** A person's saved lists: their templates/<login> document, or the starter lists until they save their own. */
const listsOf = (doc, key) => (doc && Array.isArray(doc.lists) ? doc.lists : STARTER[key] || []);

/** The department's Team Leader (first in directory order); '' when the department has none. */
function leadOf(people, managers, dept) {
  return Object.keys(people).filter(k => !managers.includes(k) && people[k].role === 'lead' && people[k].dept === dept)
    .sort((a, b) => (people[a].order || 999) - (people[b].order || 999))[0] || '';
}

/** A new task for a person's list, as the page saves one (subtasks, notes, log, dates). */
function buildTask({ id, company = 'tchb', title, owner, subOwner, subs, by, now, extra = {} }) {
  const sub = s => ({ id: newId('s'), title: clip(s.title, LIMITS.title), owner: subOwner, status: 'todo', done: false, createdAt: now, by, at: now,
    ...(s.note ? { notes: [{ id: newId('n'), text: String(s.note).slice(0, LIMITS.note), at: now, by }] } : {}) });
  return { id, company, title: clip(title, LIMITS.name), owner, done: false, order: now, subs: subs.slice(0, LIMITS.subs).map(sub),
    createdAt: now, createdBy: by, updatedBy: by, updatedAt: now, log: [{ at: now, by, ev: 'created', title: clip(title, LIMITS.name) }], ...extra };
}

// GHL sends the contact's fields at the top of the body (standard webhook), under customData (custom values), or
// under contact. The task name is TC - <address1>, <city> <state> <postal_code>.
function ghlField(body, ...names) {
  for (const src of [body, body && body.customData, body && body.contact]) {
    if (!src || typeof src !== 'object') continue;
    for (const n of names) if (src[n] != null && String(src[n]).trim()) return String(src[n]).trim();
  }
  return '';
}
function ghlAddress(body) {
  const street = ghlField(body, 'address1', 'address', 'street'), city = ghlField(body, 'city'), state = ghlField(body, 'state'),
    zip = ghlField(body, 'postal_code', 'postalCode', 'zip');
  if (!street) return '';
  return clip([street, [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(' ')].filter(Boolean).join(', '), LIMITS.address);
}
const ghlContact = body => (ghlField(body, 'contact_id', 'contactId') || String((body && body.contact && body.contact.id) || '')).replace(/[^\w-]/g, '').slice(0, 60);

const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const hash = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

module.exports = { STARTER, UPLOADS, LIMITS, clip, newId, listsOf, leadOf, buildTask, ghlField, ghlAddress, ghlContact, same, hash };
