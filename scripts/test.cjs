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

// ---- export: configured results retain the lesson's layout ----
context.cfg = { time: '00:30', speed: 200, accuracy: 97, simulate: true, unit: 'strokes', length: true, copy: true, assist: true, key: 'F8' };
context.output = run('TL.buildExport(fixture,cfg)');
const outputDoc = new DOMParser().parseFromString(context.output, 'text/html');
assert.equal(outputDoc.body.firstElementChild.id, 'time');
assert.equal(outputDoc.querySelector('#typingLabMode, #typingLabResultMode'), null);
assert.match(context.output, /typed.length>=text.length/);
assert.match(context.output, /00:30/);
assert.equal(run('TL.inspect(output).compatible'), false);
run('cfg.simulate=false;cfg.length=false;cfg.copy=false;cfg.assist=false');
assert.match(run('TL.buildExport(fixture,cfg)'), /const r=\/\[}\]\//);
// Copy-only exports keep the layout and apply the selected copy setting.
run('cfg.copy=true');
const copyOnly = new DOMParser().parseFromString(run('TL.buildExport(fixture,cfg)'), 'text/html');
assert.equal(copyOnly.body.firstElementChild.id, 'time');
assert.equal(copyOnly.querySelector('#typingLabMode, #typingLabResultMode'), null);
assert.match(copyOnly.querySelector('style').textContent, /user-select:text/);
// Re-exporting a compatible older file removes the app's previous banners.
context.olderExport = fixture.replace('<body>', '<body><p id="typingLabMode">Old banner</p>')
  .replace('<div id="finish">', '<div id="finish"><p id="typingLabResultMode">Old result note</p>');
assert.equal(run('TL.inspect(olderExport).compatible'), true);
const reexported = new DOMParser().parseFromString(run('TL.buildExport(olderExport,cfg)'), 'text/html');
assert.equal(reexported.body.firstElementChild.id, 'time');
assert.equal(reexported.getElementById('finish').textContent, '');

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

console.log('PASS: strokes, keyboard map, safe extraction, export layout, calc, settings, IME, correction accuracy, space-finalise, invisible-strip, corrupt-history, history-escape, inert preview.');

// ---- exported HTML executes and shows the configured result ----
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
assert.equal(exportDoc.getElementById('finalSpeed').textContent, '200타/phút');
assert.equal(exportDoc.getElementById('finalAccuracy').textContent, '97%');
assert.equal(exportDoc.getElementById('finish').children.length, 3);
assert.equal(exportDoc.querySelector('#typingLabMode, #typingLabResultMode'), null);
console.log('PASS: exported HTML executes and presents the configured result without added banners or result notes.');

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

// ---- held demonstration key in an exported lesson ----
context.assistFixture = fixture.replace('<body>', '<body><div class="line"><p class="source">한글</p><textarea id="first"></textarea></div><div class="line"><p class="source">가😀</p><textarea id="second"></textarea></div>');
function heldKeyLesson(key = 'F8', enabled = true, mode = 'hold') {
  context.assistKey = key;
  context.assistEnabled = enabled;
  context.assistMode = mode;
  const html = run('TL.buildExport(assistFixture,{simulate:false,copy:false,length:false,assist:assistEnabled,key:assistKey,assistMode})');
  const { window: win, document: doc } = parseHTML(html);
  const first = doc.getElementById('first'), second = doc.getElementById('second');
  first.value = second.value = '';
  let active = first, id = 0;
  const timers = new Map(), inputs = [];
  Object.defineProperty(doc, 'activeElement', { get: () => active });
  Object.defineProperty(doc, 'hidden', { value: false, writable: true });
  first.addEventListener('input', () => {
    inputs.push(first.value);
    if (first.value === '한글') { first.disabled = true; active = second; }
  });
  second.addEventListener('input', () => {
    inputs.push(second.value);
    if (second.value === '가😀') second.disabled = true;
  });
  const ctx = vm.createContext({
    document: doc, window: win, Event: win.Event, queueMicrotask: (fn) => fn(),
    setInterval: (fn) => { timers.set(++id, fn); return id; },
    clearInterval: (timer) => timers.delete(timer),
  });
  for (const script of doc.querySelectorAll('script')) vm.runInContext(script.textContent, ctx);
  const keyEvent = (type, value = key, repeat = false) => {
    const event = new win.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { key: value, repeat });
    doc.dispatchEvent(event);
    return event;
  };
  return {
    win, doc, first, second, timers, inputs, keyEvent,
    tick: () => [...timers.values()].forEach((fn) => fn()),
    focus: (element) => { active = element; },
  };
}
for (const key of ['F6', 'F7', 'F8', 'F9', 'F10']) {
  const demo = heldKeyLesson(key);
  demo.keyEvent('keydown', 'F5');
  assert.equal(demo.first.value, '');
  assert.equal(demo.keyEvent('keydown').defaultPrevented, true);
  assert.equal(demo.first.value, '한'); // one character, never the whole sentence
  demo.keyEvent('keydown', key, true);
  assert.equal(demo.first.value, '한');
  assert.equal(demo.timers.size, 1); // OS key repeat cannot create extra timers
  demo.keyEvent('keyup');
  demo.tick();
  assert.equal(demo.first.value, '한');
  assert.equal(demo.timers.size, 0);
  demo.keyEvent('keydown'); // resumes from the partial sentence
  assert.equal(demo.first.value, '한글');
  demo.tick();
  assert.equal(demo.second.value, '가');
  demo.tick();
  assert.equal(demo.second.value, '가😀'); // supplementary Unicode is not split
  demo.tick();
  assert.equal(demo.timers.size, 0); // completed/disabled field stops the timer
  assert.deepEqual(demo.inputs, ['한', '한글', '가', '가😀']);
}
for (const interrupt of ['blur', 'hidden', 'composition', 'focus']) {
  const demo = heldKeyLesson();
  demo.keyEvent('keydown');
  if (interrupt === 'blur') demo.win.dispatchEvent(new demo.win.Event('blur'));
  if (interrupt === 'hidden') { demo.doc.hidden = true; demo.doc.dispatchEvent(new demo.win.Event('visibilitychange')); }
  if (interrupt === 'composition') demo.first.dispatchEvent(new demo.win.Event('compositionstart', { bubbles: true }));
  if (interrupt === 'focus') demo.focus(demo.doc.body);
  demo.tick();
  assert.equal(demo.first.value, '한');
  assert.equal(demo.timers.size, 0);
}
const mismatch = heldKeyLesson();
mismatch.first.value = '틀';
mismatch.keyEvent('keydown');
assert.equal(mismatch.first.value, '틀');
assert.equal(mismatch.timers.size, 0);
const disabledDemo = heldKeyLesson('F8', false);
disabledDemo.keyEvent('keydown');
assert.equal(disabledDemo.first.value, '');
assert.equal(disabledDemo.timers.size, 0);
for (const mode of ['full', null]) {
  for (const key of ['F6', 'F7', 'F8', 'F9', 'F10']) {
    const demo = heldKeyLesson(key, true, mode);
    demo.keyEvent('keydown');
    assert.equal(demo.first.value, '한글');
    assert.equal(demo.second.value, '');
    assert.equal(demo.timers.size, 0);
    demo.keyEvent('keydown', key, true);
    assert.equal(demo.second.value, ''); // holding never fills subsequent fields in full mode
    demo.keyEvent('keyup');
    demo.keyEvent('keydown');
    assert.equal(demo.second.value, '가😀');
    assert.deepEqual(demo.inputs, ['한글', '가😀']);
  }
}
// The selected mode persists, and old saved configurations retain full mode.
run('TL.applySettings(TL.defaults);$("assistMode").value="hold";TL.saveSettings();$("assistMode").value="full";TL.applySettings(JSON.parse(localStorage.getItem("typinglab_editor_v23")))');
assert.equal($('assistMode').value, 'hold');
run('TL.applySettings({...TL.defaults,assist:true,key:"F6"})');
assert.equal($('assistMode').value, 'full');
assert.equal($('key').value, 'F6');
console.log('PASS: F6–F10 full/hold modes, legacy default, saved settings, release, repeat suppression, resume, Unicode and focus/IME interruption.');
