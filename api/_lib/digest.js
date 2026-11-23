// The daily digest email (owner 2026-11-23): every day at 8:00 AM Eastern, each person gets their own recap of the day
// before: what is still open for them (first), then what they finished. Their tasks are their own list plus anything they
// own in MGMT or in someone else's list (a task they own, or a subtask with their name on it). Pure functions (no
// Firebase, no network) so they can be tested with made-up data; api/hub/digest.js reads the tasks and sends it.
const ET = 'America/New_York';
const SITE = 'https://hub.totalchb.com';
const AGENT_TITLE = 'Title Commitment Agent', AGENT_NAME = 'Title Commitment & Lien Agent';   // as in the app

// ---------------------------------------------------------------- Eastern time
const parts = (ms, o) => Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: ET, ...o }).formatToParts(new Date(ms)).map(p => [p.type, p.value]));
const offsetMin = ms => { const m = /GMT([+-]\d+)(?::(\d+))?/.exec(parts(ms, { timeZoneName: 'shortOffset' }).timeZoneName || '');
  return m ? Number(m[1]) * 60 + Math.sign(Number(m[1])) * Number(m[2] || 0) : 0; };
// Midnight Eastern of a calendar day (DST changes at 2 AM, so the offset an hour after midnight is that night's).
const midnight = (y, m, d) => { const utc = Date.UTC(y, m - 1, d); return utc - offsetMin(utc + 5 * 3600e3) * 60e3; };
const ymd = ms => { const p = parts(ms, { year: 'numeric', month: '2-digit', day: '2-digit' }); return [Number(p.year), Number(p.month), Number(p.day)]; };
const shift = ([y, m, d], n) => { const t = new Date(Date.UTC(y, m - 1, d + n)); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };

/** The day being recapped (yesterday, Eastern) and today: { yStart, todayStart, todayEnd, hour, today 'YYYY-MM-DD',
 *  yLong 'Sunday, November 22', yShort 'Sun 11/22', todayLong }. */
function window(now) {
  const t = ymd(now), y = shift(t, -1), n = shift(t, 1);
  const long = ms => { const p = parts(ms, { weekday: 'long', month: 'long', day: 'numeric' }); return `${p.weekday}, ${p.month} ${p.day}`; };
  const yStart = midnight(...y), todayStart = midnight(...t);
  const sp = parts(yStart + 12 * 3600e3, { weekday: 'short', month: 'numeric', day: 'numeric' });
  return { yStart, todayStart, todayEnd: midnight(...n), hour: Number(parts(now, { hour: '2-digit', hourCycle: 'h23' }).hour),
    today: t.map((v, i) => String(v).padStart(i ? 2 : 4, '0')).join('-'), yLong: long(yStart + 12 * 3600e3), yShort: `${sp.weekday} ${sp.month}/${sp.day}`,
    todayLong: long(todayStart + 12 * 3600e3), yDay: parts(yStart + 12 * 3600e3, { weekday: 'long' }).weekday };
}
const clock = ms => { const p = parts(ms, { hour: 'numeric', minute: '2-digit', hour12: true }); return `${p.hour}:${p.minute} ${p.dayPeriod}`; };
const dayShort = ms => { const p = parts(ms, { weekday: 'short', month: 'numeric', day: 'numeric' }); return `${p.weekday} ${p.month}/${p.day}`; };

// ---------------------------------------------------------------- whose tasks, what's open, what got done (as the app)
const live = subs => (subs || []).filter(s => s.status !== 'cancelled');
const statusOf = t => { const s = t.subs || [];
  if (s.length) { const l = live(s); return !l.length ? 'cancelled' : l.every(x => x.done) ? 'done' : l.some(x => x.done || x.status === 'progress') ? 'progress' : 'todo'; }
  return t.status === 'cancelled' ? 'cancelled' : t.done ? 'done' : t.status === 'progress' ? 'progress' : 'todo'; };

/** Where a task comes from, seen by this person (the app's card tags). */
function tagOf(t, key, nameOf) {
  if (t.source) return ['agent', 'Added by ' + (t.source === AGENT_TITLE ? AGENT_NAME : t.source)];
  if (t.upload) return ['upload', 'CSV Upload ' + (t.upload.template || '')];
  if ((t.deployed || []).length) return ['deploy', 'Task Deployment ' + t.deployed.join(' + ')];
  if (!t.list) return ['mgmt', 'Added by MGMT'];
  if (t.list !== key) return ['shared', 'Shared by ' + nameOf(t.list)];
  return ['person', 'Your List'];
}

/**
 * One person's digest. tasks: every task as stored, with list = the personal list's owner key (null for MGMT).
 * keyOfName / nameOf: the team directory. Returns { open: [cards], done: [groups], finished: [titles], counts }.
 * A task counts as theirs when it is in their list or they own it; a subtask when it has their name, or no name in a
 * task of theirs. Cancelled tasks and subtasks don't count.
 */
function personDigest({ key, tasks, keyOfName, nameOf, now }) {
  const w = window(now), inY = ms => !!ms && ms >= w.yStart && ms < w.todayStart;
  const open = [], done = [], finished = [];
  const c = { done: 0, open: 0, overdue: 0, dueToday: 0, startOpen: 0 };
  const due = ms => { if (!ms) return; if (ms <= now) c.overdue++; else if (ms < w.todayEnd) c.dueToday++; };
  for (const t of tasks) {
    const st = statusOf(t);
    if (st === 'cancelled') continue;
    const mineTask = t.list === key || (!!t.owner && keyOfName(t.owner) === key);
    const subs = live(t.subs), tag = tagOf(t, key, nameOf), company = t.company === 'kpi' ? 'kpi' : 'tchb';
    if (!subs.length) {
      if (!mineTask) continue;
      if (st === 'done') { if (inY(t.doneAt)) { c.done++; c.startOpen++; done.push({ title: t.title, tag, company, items: [], whole: true, at: t.doneAt }); } continue; }
      c.open++; due(t.due); if (!(t.createdAt >= w.todayStart)) c.startOpen++;
      open.push({ title: t.title, tag, company, status: st, done: 0, total: 0, due: t.due || 0, items: [] });
      continue;
    }
    const my = subs.filter(s => (s.owner ? keyOfName(s.owner) === key : mineTask));
    if (!my.length) continue;
    const dy = my.filter(s => s.done && inY(s.doneAt)).sort((a, b) => a.doneAt - b.doneAt), op = my.filter(s => !s.done);
    if (dy.length) { c.done += dy.length; done.push({ title: t.title, tag, company, items: dy.map(s => ({ title: s.title, at: s.doneAt })), at: dy[0].doneAt }); }
    if (mineTask && st === 'done' && inY(Math.max(...subs.map(s => s.doneAt || 0)))) finished.push(t.title);
    c.startOpen += dy.length + op.filter(s => !(s.createdAt >= w.todayStart)).length;
    if (op.length) {
      c.open += op.length; op.forEach(s => due(s.due));
      open.push({ title: t.title, tag, company, status: st, done: subs.filter(s => s.done).length, total: subs.length, due: t.due || 0,
        items: op.map((s, i) => ({ title: s.title, due: s.due || 0, i })).sort((a, b) => (a.due || Infinity) - (b.due || Infinity) || a.i - b.i) });
    }
  }
  // Overdue first, then by the nearest due date (the task's or one of its open subtasks'), then the rest.
  const first = o => Math.min(o.due || Infinity, ...o.items.map(i => i.due || Infinity));
  open.sort((a, b) => first(a) - first(b));
  done.sort((a, b) => a.at - b.at);
  return { open, done, finished, counts: c, window: w };
}

// ---------------------------------------------------------------- the email (the Title Commitment & Lien Agent's design)
const INDIGO = '#4D458A', RED = '#BD2239', GREEN = '#109648', ORANGE = '#B45309';
const INK = '#211E33', BODY = '#47445A', MUTED = '#767388', LINE = '#EEEDF2', PAGE = '#F7F7F9';
const RED_BG = '#FBF0F2', GREEN_BG = '#EAF7EF', ORANGE_BG = '#FFF1E0', INDIGO_BG = '#F5F4FA';
const HEAD = "font-family:'Baloo 2','Nunito Sans',Arial,sans-serif;font-weight:700", TEXT = "font-family:'Nunito Sans',Arial,sans-serif";
const FONTS = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito+Sans:wght@400;600;700&display=swap';
const TAG = { agent: ['#8A6100', '#FDF1D6'], upload: [ORANGE, ORANGE_BG], deploy: ['#2D669F', '#E6F0FA'], mgmt: [RED, RED_BG], shared: ['#2E7D4F', '#E3F4EA'], person: [INDIGO, INDIGO_BG] };
const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const chip = (text, fg, bg, size = 11) => `<span style="${HEAD};display:inline-block;font-size:${size}px;letter-spacing:.04em;color:${fg};background:${bg};border-radius:999px;padding:3px 10px;white-space:nowrap">${esc(text)}</span>`;
const table = (rows, style = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;${style}">${rows}</table>`;
const bar = (pct, fill) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate"><tr><td style="background:${LINE};border-radius:6px;height:6px;line-height:6px;font-size:0">`
  + `<table role="presentation" width="${Math.max(2, Math.min(100, pct))}%" cellpadding="0" cellspacing="0"><tr><td style="background:${fill};border-radius:6px;height:6px;line-height:6px;font-size:0">&nbsp;</td></tr></table></td></tr></table>`;
const card = (inner, border = LINE, bg = '#ffffff') => `<tr><td style="padding:0 0 12px">${table(`<tr><td style="padding:14px 16px">${inner}</td></tr>`, `background:${bg};border:1px solid ${border};border-radius:14px`)}</td></tr>`;
const section = (title, color, note) => `<tr><td style="${HEAD};font-size:18px;color:${color};padding:6px 0 8px">${esc(title)}${note ? `<span style="${TEXT};font-weight:400;font-size:13px;color:${MUTED}"> &nbsp;${esc(note)}</span>` : ''}</td></tr>`;
const stat = (v, label, color) => `<td width="25%" align="center" style="padding:12px 4px;background:#ffffff;border:1px solid ${LINE};border-radius:12px"><div style="${HEAD};font-size:28px;line-height:1;color:${color}">${v}</div><div style="${TEXT};font-size:12px;color:${MUTED};padding-top:4px">${esc(label)}</div></td>`;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function dueChip(ms, now, w) {
  if (!ms) return '';
  if (ms <= now) return chip('Overdue · ' + dayShort(ms), RED, RED_BG);
  if (ms < w.todayEnd) return chip('Due Today · ' + clock(ms), ORANGE, ORANGE_BG);
  return ms < w.todayEnd + 2 * 86400e3 ? chip('Due ' + dayShort(ms), ORANGE, ORANGE_BG) : chip('Due ' + dayShort(ms), INDIGO, INDIGO_BG);
}

/** (subject, html) for one person's digest. first: their first name. */
function digestEmail(d, { first, now, site = SITE }) {
  const { open, done, finished, counts: c, window: w } = d;
  const pct = c.startOpen ? Math.round(100 * c.done / c.startOpen) : 0;
  const subject = `Your Hub Digest: ${c.done} Done Yesterday, ${c.open} Open, ${c.overdue} Overdue (${w.yShort})`;
  const preheader = `${first}, yesterday you finished ${plural(c.done, 'item')}. ${c.open} still open, ${c.overdue} overdue, ${c.dueToday} due today.`;
  const kpi = o => (o.company === 'kpi' ? ' ' + chip('KPI DRIVER', INDIGO, INDIGO_BG, 10) : '');
  const openCards = open.map(o => {
    const late = o.items.some(i => i.due && i.due <= now) || (!o.items.length && o.due && o.due <= now);
    const [tf, tb] = TAG[o.tag[0]] || TAG.person;
    const st = o.status === 'progress' ? chip('IN PROGRESS', INDIGO, INDIGO_BG, 10) : chip('NOT STARTED', MUTED, LINE, 10);
    const head = table(`<tr><td valign="top" style="${HEAD};font-size:16px;line-height:1.3;padding-right:8px"><a href="${esc(site)}/" style="color:${INDIGO};text-decoration:none">${esc(o.title)}</a></td>`
      + `<td valign="top" align="right" style="white-space:nowrap">${dueChip(o.due, now, w)}</td></tr>`);
    const prog = o.total ? table(`<tr><td width="150" valign="middle" style="padding:8px 10px 6px 0">${bar(Math.round(100 * o.done / o.total), RED)}</td>`
      + `<td valign="middle" style="${TEXT};font-size:12px;font-weight:700;color:${MUTED};padding:6px 0 4px;white-space:nowrap">${o.done} of ${o.total} Subtasks Done</td></tr>`, 'width:auto') : '';
    const tags = `<div style="padding:${o.total ? 0 : 8}px 0 ${o.items.length ? 8 : 0}px">${chip(o.tag[1].toUpperCase(), tf, tb, 10)} ${st}${kpi(o)}</div>`;
    const lines = o.items.map(i => `<tr><td width="18" valign="top" style="padding:8px 0 0"><span style="display:inline-block;width:10px;height:10px;border:2px solid ${i.due && i.due <= now ? RED : '#B9B6C6'};border-radius:3px"></span></td>`
      + `<td valign="top" style="${TEXT};font-size:14px;line-height:1.4;color:${INK};padding:4px 8px 4px 0">${esc(i.title)}</td>`
      + `<td valign="top" align="right" style="padding:3px 0;white-space:nowrap">${dueChip(i.due, now, w)}</td></tr>`).join('');
    return card(head + prog + tags + (lines ? `<div style="border-top:1px solid ${LINE};padding-top:6px">${table(lines)}</div>` : ''), late ? '#F1C7CF' : LINE);
  }).join('');
  const doneRows = done.map(g => g.whole
    ? `<tr><td style="padding:2px 0 10px;${TEXT};font-size:14px;color:${BODY}">${chip('Done', GREEN, '#ffffff')} &nbsp;<b style="${HEAD};color:${INK}">${esc(g.title)}</b>`
      + ` <span style="font-size:12px;color:${MUTED}">· ${esc(g.tag[1])} · ${clock(g.at)}</span>${kpi(g)}</td></tr>`
    : `<tr><td style="padding:2px 0 10px"><div style="${HEAD};font-size:15px;color:${INK}">${esc(g.title)} <span style="${TEXT};font-weight:400;font-size:12px;color:${MUTED}">· ${esc(g.tag[1])}</span>${kpi(g)}</div>`
      + table(g.items.map(i => `<tr><td width="20" valign="top" style="${HEAD};font-size:13px;color:${GREEN};padding:3px 0">&#10003;</td>`
        + `<td valign="top" style="${TEXT};font-size:14px;color:${BODY};padding:3px 8px 3px 0;text-decoration:line-through;text-decoration-color:#B9B6C6">${esc(i.title)}</td>`
        + `<td valign="top" align="right" style="${TEXT};font-size:12px;color:${MUTED};white-space:nowrap;padding:4px 0">${clock(i.at)}</td></tr>`).join('')) + '</td></tr>').join('')
    + finished.map(f => `<tr><td style="padding:2px 0 6px;${TEXT};font-size:14px;color:${BODY}">${chip('Task Finished', GREEN, '#ffffff')} &nbsp;${esc(f)}</td></tr>`).join('');
  const note = text => `<tr><td style="padding:0 0 12px">${table(`<tr><td style="padding:14px 16px;${TEXT};font-size:14px;color:${BODY}">${esc(text)}</td></tr>`, `background:#ffffff;border:1px solid ${LINE};border-radius:14px`)}</td></tr>`;
  const body = section('Still Open', INDIGO, open.length ? 'Overdue first, then by due date' : '') + (openCards || note('Nothing open for you. Nice work.'))
    + section(`Done ${w.yDay}`, GREEN, `${plural(c.done, 'item')}${finished.length ? ' · ' + plural(finished.length, 'task') + ' finished' : ''}`)
    + (doneRows ? card(table(doneRows), '#CBEBD7', GREEN_BG) : note(`Nothing was ticked off ${w.yDay}.`));
  const header = table(`<tr><td><img src="${esc(site)}/tchb-logo.png" width="150" height="46" alt="Total Cash Home Buyers" style="display:block;border:0"></td>`
    + `<td align="right" style="${HEAD};font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:${INDIGO}">Daily Digest</td></tr>`);
  const hero = `<div style="${HEAD};font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${RED}">${esc(w.todayLong)} · Your recap of ${esc(w.yDay)}</div>`
    + `<div style="${HEAD};font-size:30px;line-height:1.2;color:${INDIGO};padding-top:4px">Good Morning, <span style="color:${RED}">${esc(first)}</span></div>`
    + `<div style="${TEXT};font-size:15px;color:${BODY};padding-top:6px">What is still open for you today in the Universal Team Hub, and what you finished yesterday.</div>`;
  const stats = stat(c.open, 'Still Open', INDIGO) + stat(c.overdue, 'Overdue', c.overdue ? RED : GREEN) + stat(c.dueToday, 'Due Today', ORANGE) + stat(c.done, 'Done Yesterday', GREEN);
  const day = c.startOpen ? `<div style="${HEAD};font-size:15px;color:${INK};padding-bottom:6px">You cleared <span style="color:${GREEN}">${pct}%</span> of what was open yesterday</div>${bar(pct, '#5A4FA0')}`
    + `<div style="${TEXT};font-size:12px;color:${MUTED};padding-top:6px">${c.done} of the ${plural(c.startOpen, 'item')} you had open at the start of ${esc(w.yDay)}.</div>` : '';
  const button = `<a href="${esc(site)}/" style="${HEAD};display:inline-block;font-size:15px;color:#ffffff;background:${INDIGO};border-radius:999px;padding:10px 22px;text-decoration:none">Open The Universal Team Hub</a>`;
  const footer = 'Sent every day at 8:00 AM Eastern to each person, about their own tasks: their list, plus anything they own in MGMT or someone else\'s list. '
    + 'Turn it off: your photo &rarr; My Settings.<br>Total Cash Home Buyers · Universal Team Hub · Internal use only';
  const rows = `<tr><td style="background:#ffffff;border-radius:20px 20px 0 0;padding:18px 24px;border-bottom:1px solid ${LINE}">${header}</td></tr>`
    + `<tr><td style="background:#ffffff;padding:24px 24px 8px">${hero}</td></tr>`
    + `<tr><td style="background:#ffffff;padding:12px 18px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="6" style="border-collapse:separate"><tr>${stats}</tr></table></td></tr>`
    + (day ? `<tr><td style="background:#ffffff;padding:6px 24px 20px">${day}</td></tr>` : '')
    + `<tr><td style="background:${INDIGO_BG};padding:16px 16px 6px">${table(body)}</td></tr>`
    + `<tr><td align="center" style="background:#ffffff;border-radius:0 0 20px 20px;padding:20px 24px 26px">${button}</td></tr>`
    + `<tr><td align="center" style="${TEXT};font-size:12px;line-height:1.6;color:${MUTED};padding:18px 12px 0">${footer}</td></tr>`;
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + `<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title><link href="${FONTS}" rel="stylesheet"></head>`
    + `<body style="margin:0;padding:0;background:${PAGE}"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}"><tr><td align="center" style="padding:24px 12px">`
    + `<table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto">${rows}</table></td></tr></table></body></html>`;
  return { subject, html, preheader };
}

/** Nothing to say: nothing open and nothing done the day before (no email that day). */
const isEmpty = d => !d.counts.open && !d.counts.done && !d.finished.length;

module.exports = { window, personDigest, digestEmail, isEmpty, statusOf, tagOf };
