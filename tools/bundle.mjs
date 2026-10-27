// node tools/bundle.mjs unpack   → writes app/app.dc.html (readable source)
// node tools/bundle.mjs pack     → writes app/app.dc.html back into index.html
import fs from 'node:fs';
const FILE = 'index.html', SRC = 'app/app.dc.html';
const OPEN = '<script type="__bundler/template">';
const html = fs.readFileSync(FILE, 'utf8');
const a = html.indexOf(OPEN); if (a < 0) throw new Error('template block not found');
const s = a + OPEN.length, e = html.indexOf('</script>', s);
const mode = process.argv[2];
if (mode === 'unpack') {
  fs.mkdirSync('app', { recursive: true });
  fs.writeFileSync(SRC, JSON.parse(html.slice(s, e)));
  console.log('unpacked →', SRC);
} else if (mode === 'pack') {
  const enc = JSON.stringify(fs.readFileSync(SRC, 'utf8')).replace(/<\//g, '<\\u002F');
  fs.writeFileSync(FILE, html.slice(0, s) + '\n' + enc + '\n  ' + html.slice(e));
  console.log('packed →', FILE);
} else console.log('usage: unpack | pack');
