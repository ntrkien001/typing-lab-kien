/* DOM integration checks for Typing Lab 2.4.
 * Runs the real src/*.js modules against a linkedom DOM (no browser, no uploaded
 * scripts executed). This is NOT a substitute for real-browser or hardware IME
 * testing — see tests/e2e.mjs for the Playwright/IME checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { parseHTML, DOMParser } = require('linkedom');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const { window } = parseHTML(read('index.html'));
const document = window.document;

// Minimal control-value shims linkedom lacks.
for (const el of document.querySelectorAll('input[type=checkbox]')) el.checked = el.hasAttribute('checked');
for (const el of document.querySelectorAll('select')) {
  let value = el.querySelector('option').getAttribute('value') || el.querySelector('option').textContent;
  Object.defineProperty(el, 'value', { get: () => value, set: (v) => { value = String(v); }, configurable: true });
}
const mkCtx = () => ({
  clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fillText() {},
  fillRect() {}, setTransform() {}, arc() {}, fill() {}, rect() {}, closePath() {}, save() {}, restore() {},
});
for (const id of ['chart', 'progress']) { const c = document.getElementById(id); if (c) c.getContext = mkCtx; }

const memory = new Map();
const storage = { getItem: (k) => (memory.has(k) ? memory.get(k) : null), setItem: (k, v) => memory.set(k, String(v)), removeItem: (k) => memory.delete(k) };
window.devicePixelRatio = 1;

const context = vm.createContext({
  window, document, DOMParser, console, performance, Date, URL, Blob, TextDecoder,
  localStorage: storage, navigator: {}, Event: window.Event,
  setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, queueMicrotask: (fn) => fn(), confirm: () => true,
});
const run = (code) => vm.runInContext(code, context);

// Load Acorn (sets global + window.acorn so lesson.js uses it synchronously), then the app.
run(read('vendor/acorn.js'));
run('window.acorn = acorn;');
for (const f of ['core', 'hangul', 'keyboard', 'practice', 'history', 'lesson', 'ui', 'pwa'])
  vm.runInContext(read('src/' + f + '.js'), context, { filename: 'src/' + f + '.js' });

const TL = context.window.TL;
context.TL = TL;
context.$ = TL.$;
const $ = (id) => document.getElementById(id);

// ---- Hangul strokes (unchanged from 2.3) ----
assert.equal(TL.countStroke('과'), 3);
assert.equal(TL.countStroke('외'), 3);
assert.equal(TL.countStroke('위'), 3);
assert.equal(TL.countStroke('값'), 4);
assert.equal(TL.countStroke('한'), 3);

// ---- keyboard key mapping ----
assert.deepEqual(Array.from(TL.keysForChar('과')), ['r', 'h', 'k']); // ㄱ=r, ㅘ=ㅗ(h)+ㅏ(k)
assert.deepEqual(Array.from(TL.keysForChar('값')), ['r', 'k', 'q', 't']); // ㄱ ㅏ ㅂㅅ
assert.deepEqual(Array.from(TL.keysForChar(' ')), ['space']);

// ---- safe lesson extraction ----
const fixture = `<!doctype html><html><head><title>Test</title></head><body><div id="time"></div><div id="speed"></div><div id="accuracy"></div><div id="progress"></div><div id="finish"><b id="finalTime"></b><b id="finalSpeed"></b><b id="finalAccuracy"></b></div><script>const texts = ["한글", 'It\\'s a [test]', "위 과 값"];let timer;function finish () { // comment with }
 const r=/[}]/; document.getElementById('finish').style.display='block'; } function check(typed,text){if (typed === text) {finish();}}</script></body></html>`;
context.fixture = fixture;
assert.equal(run('TL.inspect(fixture).nodes[1]'), "It's a [test]");
assert.equal(run('TL.inspect(fixture).compatible'), true);
context.malicious = '<script>window.pwned=1;const texts=["정상"];</script>';
assert.equal(run('TL.inspect(malicious).nodes[0]'), '정상');
assert.equal(window.pwned, undefined);
assert.equal(run('TL.inspect("<div class=source>  한  </div>").nodes[0]'), '한'); // trimmed (bug fix)

// ---- export: simulation + assistance labelling ----
context.cfg = { time: '00:30', speed: 200, accuracy: 97, simulate: true, unit: 'strokes', length: true, copy: true, assist: true, key: 'F8' };
context.output = run('TL.buildExport(fixture,cfg)');
assert.match(context.output, /Kết quả mô phỏng/);
assert.match(context.output, /typed.length>=text.length/);
assert.match(context.output, /00:30/);
assert.equal(run('TL.inspect(output).compatible'), false);
run('cfg.simulate=false;cfg.length=false;cfg.copy=false;cfg.assist=false');
assert.match(run('TL.buildExport(fixture,cfg)'), /const r=\/\[}\]\//);
// copy-only export must now be labelled as assisted (2.3 mislabelled it "Bài luyện")
run('cfg.copy=true');
const copyOnly = new DOMParser().parseFromString(run('TL.buildExport(fixture,cfg)'), 'text/html');
assert.match(copyOnly.getElementById('typingLabMode').textContent, /có hỗ trợ/);

// ---- editor speed/time calculation ----
run('TL.uploaded=TL.inspect(fixture);$("unit").value="chars";$("em").value="0";$("es").value="30";TL.preview()');
assert.notEqual($('requiredSpeed').textContent, '—');
run('$("es").value="0";TL.preview()');
assert.equal($('requiredSpeed').textContent, '—');

// ---- settings persistence ----
run('TL.applySettings(TL.defaults);$("ev").value="333";TL.saveSettings();$("ev").value="1";TL.applySettings(JSON.parse(localStorage.getItem("typinglab_editor_v23")))');
assert.equal($('ev').value, '333');

// ---- IME: no scoring/advancing while a composition is active ----
run('TL.setLesson(["한"]);TL.S.composing=true;$("typing").value="ㅎ";TL.commitInput()');
assert.equal(run('TL.S.index'), 0);
assert.equal(run('TL.S.keys'), 0);
run('TL.S.composing=false;$("typing").value="한";TL.beginTyping();TL.commitInput()');
assert.equal(run('TL.S.finished'), true);
assert.equal(run('TL.S.errors'), 0);
assert.equal(run('TL.S.keys'), 1);
const frozen = run('TL.calc().speed');
assert.equal(run('TL.calc().speed'), frozen);
assert.equal($('p').textContent, '100%');

// ---- correction accuracy ----
run('TL.setLesson(["가나다"]);$("typing").value="가x";TL.beginTyping();TL.commitInput();$("typing").value="가나";TL.commitInput();$("typing").value="가나다";TL.commitInput()');
assert.equal(run('TL.calc().accuracy'), 75);

// ---- NEW: Space/Enter finalise must not create an error ----
run('TL.setLesson(["가나다","라마"]);$("typing").value="가나다 ";TL.beginTyping();TL.commitInput()');
assert.equal(run('TL.S.index'), 1); // advanced
assert.equal(run('TL.S.errors'), 0); // trailing space ignored
run('$("typing").value=" ";TL.commitInput()'); // leading space bleed into new sentence
assert.equal(run('TL.S.index'), 1);
assert.equal(run('TL.S.errors'), 0);
assert.equal($('typing').value, ''); // stripped

// ---- NEW: invisible characters stripped from custom lesson ----
run('TL.setLesson(["다\\u200B라"])');
assert.equal(run('TL.S.arr[0]'), '다라');

// ---- NEW: corrupted history never throws; finish() still records ----
memory.set('typinglab_history', '{}');
run('TL.setLesson(["가"]);$("typing").value="가";TL.beginTyping();TL.commitInput()');
assert.equal(run('TL.S.finished'), true);
assert.equal(Array.isArray(JSON.parse(memory.get('typinglab_history'))), true);

// ---- NEW: history rendering escapes every field ----
memory.set('typinglab_history', JSON.stringify([{ date: new Date().toISOString(), duration: 60, speed: '<img src=x onerror=alert(1)>', accuracy: 99, metricVersion: 2 }]));
run('TL.renderHistory()');
assert.match($('historyList').innerHTML, /&lt;img/);
assert.doesNotMatch($('historyList').innerHTML, /<img/);

// ---- standalone preview document is inert, parseable JS ----
run('acorn.parse(TL.lessonDocument(["</scr"+"ipt><img src=x onerror=alert(1)>"]).match(/<script>([\\s\\S]*?)<\\/script>/)[1],{ecmaVersion:"latest"})');

console.log('PASS: strokes, keyboard map, safe extraction, labelled exports, calc, settings, IME, correction accuracy, space-finalise, invisible-strip, corrupt-history, history-escape, inert preview.');

// ---- exported simulation executes and shows the configured, labelled result ----
run('cfg.simulate=true;cfg.length=false;cfg.copy=false;cfg.assist=false;cfg.time="00:30";cfg.speed=200;cfg.accuracy=97;cfg.unit="strokes"');
const out2 = run('TL.buildExport(fixture,cfg)');
const exported = parseHTML(out2);
const exportDoc = exported.document;
exported.window.scrollTo = () => {};
const tasks = [];
const exportContext = vm.createContext({ document: exportDoc, window: exported.window, clearInterval() {}, Event: exported.window.Event, queueMicrotask: (fn) => tasks.push(fn) });
for (const el of exportDoc.querySelectorAll('script')) vm.runInContext(el.textContent, exportContext);
vm.runInContext('check("한글","한글")', exportContext);
tasks.forEach((fn) => fn());
assert.equal(exportDoc.getElementById('finalTime').textContent, '00:30');
assert.equal(exportDoc.getElementById('speed').textContent, '200');
assert.match(exportDoc.getElementById('finish').textContent, /Kết quả mô phỏng/);
console.log('PASS: exported HTML executes and presents the configured simulation with a visible, non-removable label.');

// Invalid individual records must not crash history or session completion.
memory.set('typinglab_history', JSON.stringify([null, {date:'invalid',metricVersion:2,speed:100}]));
assert.doesNotThrow(() => run('TL.renderHistory()'));
assert.equal(TL.loadHistory().length, 0);
run('TL.setLesson(["가"]);$("typing").value="가";TL.beginTyping();TL.commitInput();TL.reset()');
assert.equal($('ms').textContent, '0 타');
assert.equal($('mt').textContent, '00:00');
assert.equal($('ma').textContent, '100%');
// Export is UTF-8 even if the original Korean HTML declares EUC-KR.
context.legacy = fixture.replace('<head>', '<head><meta charset="euc-kr"><meta http-equiv="Content-Type" content="text/html;charset=euc-kr">');
const legacyDoc = new DOMParser().parseFromString(run('TL.buildExport(legacy,cfg)'), 'text/html');
assert.equal(legacyDoc.querySelector('meta[charset]').getAttribute('charset'), 'utf-8');
assert.equal(legacyDoc.querySelector('meta[http-equiv]'), null);
console.log('PASS: invalid individual history entries, mobile reset metrics, UTF-8 export metadata.');
