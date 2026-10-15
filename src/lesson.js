/* Typing Lab 2.4 — lesson file tools (the "Chỉnh file HTML" tab).
 * Reads an uploaded typing-practice HTML file WITHOUT executing it: lesson text
 * is pulled from the `texts` array via Acorn's AST, or from `.source` elements
 * via inert DOM parsing. Preview runs in a sandboxed iframe. Exports keep the
 * original input and carry a mandatory, non-removable mode label.
 *
 * Acorn is ~240 KB and only this tab needs it, so it is loaded on demand. */
(function (TL) {
  'use strict';

  let acornPromise = null;
  TL.loadAcorn = function () {
    if (window.acorn) return Promise.resolve(window.acorn);
    if (acornPromise) return acornPromise;
    acornPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/acorn.js';
      s.onload = () => res(window.acorn);
      s.onerror = () => {
        acornPromise = null;
        rej(new Error('Không tải được bộ phân tích cú pháp (acorn.js).'));
      };
      document.head.appendChild(s);
    });
    return acornPromise;
  };

  // Decode an uploaded file, honouring a non-UTF-8 <meta charset> (e.g. EUC-KR,
  // common in older Korean lesson files). 2.3 always used UTF-8 and silently
  // produced mojibake.
  TL.decodeFile = function (buf) {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const m = text.match(/charset\s*=\s*["']?\s*([\w-]+)/i);
    const cs = m && m[1] ? m[1].toLowerCase().replace(/^ks_c_5601.*/, 'euc-kr') : '';
    if (cs && !/utf-?8/.test(cs)) {
      try {
        return { text: new TextDecoder(cs).decode(buf), charset: cs };
      } catch {
        /* unknown label — fall through */
      }
    }
    if (/�/.test(text)) {
      try {
        const t2 = new TextDecoder('euc-kr').decode(buf);
        if (!/�/.test(t2)) return { text: t2, charset: 'euc-kr' };
      } catch {}
      return { text, charset: 'utf-8', suspect: true };
    }
    return { text, charset: 'utf-8' };
  };

  function walk(node, fn) {
    if (!node || typeof node !== 'object') return;
    fn(node);
    for (const [k, v] of Object.entries(node)) {
      if (k === 'start' || k === 'end') continue;
      if (Array.isArray(v)) v.forEach((x) => walk(x, fn));
      else if (v && typeof v === 'object') walk(v, fn);
    }
  }

  function parseScripts(doc) {
    return [...doc.querySelectorAll('script:not([src])')].map((el) => {
      try {
        return { el, code: el.textContent, ast: window.acorn.parse(el.textContent, { ecmaVersion: 'latest', sourceType: el.type === 'module' ? 'module' : 'script' }) };
      } catch {
        return { el, code: el.textContent, ast: null };
      }
    });
  }

  const isCondition = (n) =>
    n.type === 'BinaryExpression' &&
    ['===', '=='].includes(n.operator) &&
    n.left?.type === 'Identifier' && n.left.name === 'typed' &&
    n.right?.type === 'Identifier' && n.right.name === 'text';
  TL._isCondition = isCondition;
  TL._parseScripts = parseScripts;
  TL._walk = walk;

  function inspect(text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const scripts = parseScripts(doc);
    const candidates = [];
    for (const script of scripts)
      walk(script.ast, (n) => {
        if (
          n.type === 'VariableDeclarator' && n.id?.name === 'texts' &&
          n.init?.type === 'ArrayExpression' && n.init.elements.length &&
          n.init.elements.every((e) => e?.type === 'Literal' && typeof e.value === 'string')
        )
          candidates.push(n.init.elements.map((e) => e.value));
      });
    if (candidates.length > 1) throw Error('Có nhiều mảng texts. Chưa xác định được bài chính; file gốc được giữ nguyên.');
    let nodes = candidates[0],
      origin = 'Mảng texts (đọc cú pháp, không thực thi mã)';
    if (!nodes) {
      nodes = [...doc.querySelectorAll('.source')].map((x) => x.textContent);
      origin = 'Các phần tử .source';
    }
    nodes = nodes.map(TL.cleanLine).filter(Boolean); // trim + strip invisibles (bug fixes)
    if (!nodes.length) throw Error('Không tìm được bài. Hỗ trợ mảng texts chứa chuỗi hoặc phần tử .source.');
    const joined = nodes.join('');
    if (joined.length > 100000) throw Error('Bài vượt giới hạn 100.000 ký tự. Hãy chia thành các bài nhỏ.');
    let finishCount = 0,
      conditionCount = 0;
    const invalid = scripts.some((s) => !s.ast);
    scripts.forEach((s) =>
      walk(s.ast, (n) => {
        if (n.type === 'FunctionDeclaration' && n.id?.name === 'finish') finishCount++;
        if (isCondition(n)) conditionCount++;
      })
    );
    const ids = ['finalTime', 'finalSpeed', 'finalAccuracy', 'finish', 'time', 'speed', 'accuracy', 'progress'];
    const missing = ids.filter((id) => !doc.getElementById(id));
    return {
      nodes, origin,
      total: Array.from(joined).length,
      without: Array.from(joined).filter((c) => !/\s/u.test(c)).length,
      spaces: Array.from(joined).filter((c) => /\s/u.test(c)).length,
      strokes: Array.from(joined).reduce((n, c) => n + TL.countStroke(c), 0),
      hangul: Array.from(joined).filter((c) => /[가-힣]/u.test(c)).length,
      compatible: finishCount === 1 && conditionCount === 1 && !missing.length && !invalid,
      reason: invalid
        ? 'Có script không đọc được cú pháp.'
        : missing.length
        ? 'Thiếu vùng kết quả: ' + missing.join(', ')
        : finishCount !== 1 || conditionCount !== 1
        ? 'Cấu trúc chuyển câu hoặc hoàn thành khác mẫu hỗ trợ.'
        : 'Đủ cấu trúc chỉnh file gốc.',
      source: text,
    };
  }
  TL.inspect = inspect;

  function lessonDocument(nodes) {
    const data = JSON.stringify(nodes).replace(/</g, '\\u003c');
    return (
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; connect-src \'none\'; form-action \'none\'"><title>Xem thử bài</title><style>body{font:17px system-ui;background:#f5f7fb;color:#172538;padding:20px}p{line-height:1.8;white-space:pre-wrap}textarea{box-sizing:border-box;width:100%;font:inherit;padding:12px;min-height:90px}#result{color:#137547}</style></head><body><small>XEM THỬ NỘI DUNG · Nhập đúng để qua câu</small><p id="count"></p><p id="text"></p><textarea id="input" spellcheck="false" aria-label="Nhập câu tiếng Hàn"></textarea><p id="result"></p><scr' +
      'ipt>const lines=' + data +
      ';let i=0,composing=false;const input=document.getElementById("input"),text=document.getElementById("text");function show(){text.textContent=lines[i];document.getElementById("count").textContent=(i+1)+" / "+lines.length}function check(){if(composing||input.value.normalize("NFC")!==lines[i])return;i++;if(i===lines.length){input.disabled=true;document.getElementById("result").textContent="Hoàn thành xem thử.";return}input.value="";show()}input.oncompositionstart=()=>composing=true;input.oncompositionend=()=>{composing=false;check()};input.oninput=e=>{if(!e.isComposing)check()};show();</scr' +
      'ipt></body></html>'
    );
  }
  TL.lessonDocument = lessonDocument;

  function buildExport(source, cfg) {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    // Blob exports are UTF-8; discard legacy declarations before serialization.
    doc.querySelectorAll('meta[charset], meta[http-equiv]').forEach((meta) => {
      if (meta.hasAttribute('charset') || /^(content-type)$/i.test(meta.getAttribute('http-equiv') || '')) meta.remove();
    });
    const charset = doc.createElement('meta');
    charset.setAttribute('charset', 'utf-8');
    doc.head.insertBefore(charset, doc.head.firstChild);
    const scripts = parseScripts(doc);
    const patch = [];
    for (const s of scripts) {
      const edits = [];
      walk(s.ast, (n) => {
        if (n.type === 'FunctionDeclaration' && n.id?.name === 'finish' && cfg.simulate) {
          const unit = cfg.unit === 'chars' ? ' ký tự/phút' : '타/phút';
          const body =
            'clearInterval(timer);' +
            [['finalTime', cfg.time], ['finalSpeed', cfg.speed + unit], ['finalAccuracy', cfg.accuracy + '%'], ['time', cfg.time], ['speed', cfg.speed], ['accuracy', cfg.accuracy], ['progress', '100']]
              .map(([id, v]) => 'document.getElementById(' + JSON.stringify(id) + ').textContent=' + JSON.stringify(v) + ';')
              .join('') +
            'document.getElementById("finish").style.display="block";window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"});queueMicrotask(()=>{' +
            [['time', cfg.time], ['speed', cfg.speed], ['accuracy', cfg.accuracy], ['progress', '100']]
              .map(([id, v]) => 'document.getElementById(' + JSON.stringify(id) + ').textContent=' + JSON.stringify(v) + ';')
              .join('') +
            '});';
          edits.push({ start: n.body.start + 1, end: n.body.end - 1, text: body });
        }
        if (cfg.length && isCondition(n)) edits.push({ start: n.start, end: n.end, text: 'typed.length>=text.length' });
      });
      edits.sort((a, b) => b.start - a.start);
      let code = s.code;
      for (const e of edits) code = code.slice(0, e.start) + e.text + code.slice(e.end);
      patch.push([s.el, code]);
    }
    for (const [el, code] of patch) el.textContent = code;
    if (cfg.copy) {
      const style = doc.createElement('style');
      style.textContent = 'body,.source{user-select:text!important;-webkit-user-select:text!important}';
      doc.head.appendChild(style);
    }
    // Mandatory, honest mode label. 2.3 only flagged assistance for length/assist
    // and MISSED copy-only exports (they were labelled plain practice). Fixed:
    // enabling copy/paste is assistance too.
    const assisted = cfg.assist || cfg.length || cfg.copy;
    const badge = doc.createElement('p');
    badge.id = 'typingLabMode';
    badge.textContent = cfg.simulate
      ? '모의 결과 · Kết quả mô phỏng, không phải kết quả đo thực tế.'
      : assisted
      ? '연습 지원 · Bài luyện có hỗ trợ (không phải điều kiện gõ tiêu chuẩn).'
      : 'Typing Lab · Bài luyện';
    badge.style.cssText = 'background:#fff4da;color:#644400;padding:12px;font:14px system-ui';
    doc.body.insertBefore(badge, doc.body.firstChild);
    if (cfg.simulate) {
      const note = badge.cloneNode(true);
      note.id = 'typingLabResultMode';
      doc.getElementById('finish').appendChild(note);
    }
    const helper = doc.createElement('script');
    helper.textContent =
      '(' +
      function (options) {
        document.addEventListener('input', (e) => { if (e.isComposing && e.target.tagName === 'TEXTAREA') e.stopImmediatePropagation(); }, true);
        document.addEventListener('compositionend', (e) => { if (e.target.tagName === 'TEXTAREA') e.target.dispatchEvent(new Event('input', { bubbles: true })); }, true);
        if (options.copy) for (const type of ['copy', 'cut', 'paste', 'contextmenu', 'dragstart']) document.addEventListener(type, (e) => e.stopImmediatePropagation(), true);
        if (options.assist)
          document.addEventListener('keydown', (e) => {
            if (e.key !== options.key || e.repeat) return;
            const a = document.activeElement,
              box = a?.closest('.line'),
              node = box?.querySelector('.source');
            if (!a || a.tagName !== 'TEXTAREA' || a.disabled || !node) return;
            e.preventDefault();
            a.value = node.textContent;
            a.dispatchEvent(new Event('input', { bubbles: true }));
          }, true);
      }.toString() +
      ')(' + JSON.stringify({ copy: cfg.copy, assist: cfg.assist, key: cfg.key }) + ');';
    doc.head.insertBefore(helper, doc.head.firstChild);
    for (const s of parseScripts(doc)) if (!s.ast) throw Error('Bản xuất có lỗi cú pháp. Không tải xuống.');
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }
  TL.buildExport = buildExport;
})(window.TL);
