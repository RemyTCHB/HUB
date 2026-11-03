// Builds the in-app Help (My Settings → Help) from the three guides' Markdown:
//   node tools/help-build.mjs <user.md> <lead.md> <manager.md> <screenshots dir>
// → help/guides.json ({ member, lead, manager }: { title, sections: [{ id, title }], html }) and help/img/*.jpg.
// The delete passwords are never written here: each password table becomes <div data-hub-pw></div>, which the page
// fills from POST /api/hub/passwords after sign-in. The build stops if a password is left in. Screenshots use
// made-up sample tasks only.
import fs from 'node:fs';
import path from 'node:path';

const [userMd, leadMd, managerMd, shotsDir] = process.argv.slice(2);
if (!shotsDir) { console.error('usage: node tools/help-build.mjs <user.md> <lead.md> <manager.md> <screenshots dir>'); process.exit(1); }
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'help');
fs.mkdirSync(path.join(OUT, 'img'), { recursive: true });

const SMALL = new Set(['and', 'or', 'of', 'the', 'a', 'to', 'for', 'in', 'on', 'with', 'by']);
const cap = w => w[0] === '(' ? '(' + w.charAt(1).toUpperCase() + w.slice(2) : w.charAt(0).toUpperCase() + w.slice(1);
const title = t => t.split(/\s+/).map((w, i) => w === w.toUpperCase() || (i && SMALL.has(w)) ? w : cap(w)).join(' ');
const esc = s => s.replace(/&(?!#?\w+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const S = {
  h2: 'font-family: var(--font-display); font-weight: 800; font-size: 22px; line-height: 1.25; color: var(--tchb-indigo-700); margin: 30px 0 8px; padding-top: 14px; border-top: 1px solid var(--border-default);',
  num: 'color: var(--tchb-red-500); margin-right: 10px;',
  h3: 'font-family: var(--font-display); font-weight: 700; font-size: 17px; color: var(--tchb-indigo-700); margin: 20px 0 6px;',
  p: 'margin: 0 0 12px; font-size: 15px; line-height: 1.6; color: var(--text-body);',
  lead: 'margin: 14px 0 6px; font-size: 16px; line-height: 1.6; color: var(--text-muted);',
  list: 'margin: 0 0 12px; padding-left: 22px; font-size: 15px; line-height: 1.6; color: var(--text-body);',
  li: 'margin: 0 0 5px;',
  quote: 'margin: 8px 0 14px; padding: 10px 14px; border-left: 4px solid var(--tchb-indigo-500); border-radius: 0 10px 10px 0; background: var(--tchb-indigo-050); font-size: 15px; line-height: 1.55; color: var(--text-body);',
  wrap: 'overflow-x: auto; margin: 8px 0 14px; border: 1px solid var(--border-default); border-radius: 12px;',
  table: 'width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.45; color: var(--text-body);',
  th: 'padding: 9px 12px; text-align: left; font-family: var(--font-display); font-weight: 700; font-size: 13px; color: #fff; background: var(--action-secondary); white-space: nowrap;',
  td: 'padding: 9px 12px; border-top: 1px solid var(--border-default); vertical-align: top;',
  fig: 'margin: 10px 0 18px; text-align: center;',
  img: 'display: block; margin: 0 auto; max-width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border-default); box-shadow: var(--shadow-card);',
  phone: 'display: block; margin: 0 auto; width: 260px; max-width: 70%; height: auto; border-radius: 18px; border: 1px solid var(--border-default); box-shadow: var(--shadow-card);',
  cap: 'margin-top: 6px; font-size: 13px; color: var(--text-muted);',
  code: 'font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; background: var(--tchb-indigo-050); color: var(--tchb-indigo-700); padding: 1px 5px; border-radius: 5px;',
};
// A JPEG's width and height (from its SOF marker), so the page reserves the space before the image loads.
function jpegSize(file) {
  const b = fs.readFileSync(file);
  for (let i = 2; i < b.length;) {
    if (b[i] !== 0xFF) { i++; continue; }
    const m = b[i + 1], len = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return { w: 0, h: 0 };
}
const inline = t => esc(t).replace(/\\_/g, '_')
  .replace(/`([^`]+)`/g, (_, c) => `<code style="${S.code}">${c}</code>`)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
  .replace(/(^|[^\w*])\*([^*\n]+?)\*(?![\w*])/g, '$1<i>$2</i>');

function build(file, name) {
  let L = fs.readFileSync(file, 'utf8').split('\n');
  // Password tables → the slot the page fills after sign-in.
  for (let i = 0; i < L.length; i++) {
    if (/^### (Department passwords|All delete passwords)/.test(L[i])) {
      let j = i + 1; while (j < L.length && !L[j].trim()) j++;
      const k = j; while (j < L.length && L[j].startsWith('|')) j++;
      L.splice(k, j - k, '[[passwords]]');
    }
  }
  const first = L.findIndex(x => x.startsWith('## '));
  const intro = L.slice(0, first).filter(x => x.trim() && !x.startsWith('# ') && !/·\s*@/.test(x)).join(' ');
  L = L.slice(first);
  const out = intro ? [`<p style="${S.lead}">${inline(intro)}</p>`] : [], sections = [], imgs = [];
  for (let i = 0; i < L.length;) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    if (l.startsWith('## ')) {
      const t = title(l.slice(3).trim()), n = sections.length, id = 'h-' + t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      sections.push({ id, title: t });
      out.push(`<h2 id="${id}" data-sec="${n}" style="${S.h2}${n ? '' : ' border-top: none;'}"><span style="${S.num}">${String(n + 1).padStart(2, '0')}</span>${inline(t)}</h2>`); i++; continue;
    }
    if (l.startsWith('### ')) { out.push(`<h3 style="${S.h3}">${inline(title(l.slice(4).trim()))}</h3>`); i++; continue; }
    if (l.trim() === '[[passwords]]') { out.push('<div data-hub-pw></div>'); i++; continue; }
    const im = /^!\[(.*?)\]\((.*?)\)/.exec(l);
    if (im) {
      const base = path.basename(im[2]), { w, h } = jpegSize(path.join(shotsDir, base)); imgs.push(base);
      out.push(`<figure style="${S.fig}"><img src="help/img/${base}" alt="${esc(im[1])}" width="${w}" height="${h}" loading="lazy" style="${/phone/.test(base) ? S.phone : S.img}"><figcaption style="${S.cap}">${inline(im[1])}</figcaption></figure>`); i++; continue;
    }
    if (l.startsWith('>')) { const q = []; while (i < L.length && L[i].startsWith('>')) q.push(L[i++].replace(/^>\s?/, '')); out.push(`<div style="${S.quote}">${inline(q.join(' '))}</div>`); continue; }
    if (l.startsWith('|')) {
      const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
      const [head, , ...body] = rows;
      out.push(`<div style="${S.wrap}"><table style="${S.table}"><thead><tr>${head.map(c => `<th style="${S.th}">${inline(c)}</th>`).join('')}</tr></thead><tbody>`
        + body.map(r => '<tr>' + r.map((c, j) => `<td style="${S.td}${j ? '' : ' font-weight: 700;'}">${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\d+\. /.test(l) || l.startsWith('- ')) {
      const ol = /^\d+\. /.test(l), items = [];
      while (i < L.length && (ol ? /^\d+\. /.test(L[i]) : L[i].startsWith('- '))) items.push(L[i++].replace(/^(\d+\. |- )/, ''));
      out.push(`<${ol ? 'ol' : 'ul'} style="${S.list}">${items.map(x => `<li style="${S.li}">${inline(x)}</li>`).join('')}</${ol ? 'ol' : 'ul'}>`); continue;
    }
    const para = []; while (i < L.length && L[i].trim() && !/^(#|\||>|!\[|\d+\. |- |\[\[)/.test(L[i])) para.push(L[i++]);
    out.push(`<p style="${S.p}">${inline(para.join(' '))}</p>`);
  }
  const html = out.join('\n');
  if (/2027\$|@Confirm|TL-[A-Z]+-\d/.test(html)) throw new Error(name + ': a delete password is still in the Help text');
  for (const f of imgs) fs.copyFileSync(path.join(shotsDir, f), path.join(OUT, 'img', f));
  return { title: name, sections, html, images: imgs.length };
}

const guides = { member: build(userMd, 'User Guide'), lead: build(leadMd, 'Team Leader Guide'), manager: build(managerMd, 'Manager Guide') };
fs.writeFileSync(path.join(OUT, 'guides.json'), JSON.stringify(guides));
for (const [k, g] of Object.entries(guides)) console.log(k, g.sections.length, 'sections,', g.images, 'screenshots');
