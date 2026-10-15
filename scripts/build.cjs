/* Build a deployable dist/ for Vercel.
 * - Concatenates src/*.js into one inlined bundle and inlines styles.css into
 *   index.html so the page loads with no extra round-trips.
 * - Leaves Acorn as a separate vendor/acorn.js that lesson.js loads on demand
 *   (it is ~240 KB and only the editor tab needs it).
 * - Copies the PWA assets.
 * - Asserts the inlining actually happened (2.3 could print "Built" while the
 *   generated file still pointed at files that would not exist on the host). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const MODULES = ['core', 'hangul', 'keyboard', 'practice', 'history', 'lesson', 'ui', 'pwa'].map((n) => 'src/' + n + '.js');

// Fail fast on a syntax error in any shipped script.
for (const f of MODULES) new vm.Script(read(f), { filename: f });
new vm.Script(read('vendor/acorn.js'), { filename: 'vendor/acorn.js' });

const bundle = MODULES.map((f) => '/* ===== ' + f + ' ===== */\n' + read(f)).join('\n');
const embed = (code) => '<script>\n' + code.replace(/<\/script/gi, '<\\/script') + '\n</script>';

let html = read('index.html');

if (!html.includes('href="styles.css"')) throw Error('build: stylesheet link not found in index.html');
html = html.replace('<link rel="stylesheet" href="styles.css" />', '<style>\n' + read('styles.css') + '\n</style>');

const beforeScripts = html;
html = html.replace(/\n?\s*<script defer src="src\/[a-z]+\.js"><\/script>/g, '');
if (html === beforeScripts) throw Error('build: module <script> tags not found in index.html');
html = html.replace('</body>', '  ' + embed(bundle) + '\n</body>');

// Hard guarantee: nothing in the shipped page may reference the un-bundled sources.
if (/src="src\//.test(html) || /href="styles\.css"/.test(html)) throw Error('build: inlining incomplete');

const dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'vendor'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
fs.copyFileSync(path.join(root, 'vendor/acorn.js'), path.join(dist, 'vendor/acorn.js'));

let copied = 0;
for (const f of ['manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png']) {
  const p = path.join(root, f);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(dist, f));
    copied++;
  }
}

console.log('Built dist/index.html: ' + Buffer.byteLength(html) + ' bytes; + vendor/acorn.js (lazy) and ' + copied + ' PWA assets.');
