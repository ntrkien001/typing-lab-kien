/* Typing Lab 2.4 — the real typing engine.
 * Fixes the 2.3 bug where the Space/Enter used to finalise the last Korean
 * syllable leaked into the next sentence and was scored as an error. */
(function (TL) {
  'use strict';
  const $ = TL.$;

  const defaultTexts = [
    '오늘은 토요일입니다', '지우는 아침에 일찍 일어났습니다', '창밖에는 비가 내리고 있었습니다',
    '지우는 우산을 챙겨 동네 빵집으로 갔습니다', '빵집에서 따뜻한 빵을 사고 도서관으로 갔습니다',
    '도서관에는 책을 읽는 사람들이 많았습니다', '지우는 창가에 앉아 바다를 여행하는 소년의 책을 골랐습니다',
    '소년은 작은 배를 타고 먼 섬으로 떠났습니다', '섬에는 키가 큰 나무와 예쁜 꽃이 있었습니다',
    '지우는 이야기에 빠져 시간 가는 줄 몰랐습니다', '책을 읽다가 배가 고파져 빵을 꺼내 먹었습니다',
    '책을 다 읽고 도서관을 나오자 비가 그쳐 있었습니다', '지우는 집으로 가는 길에 꽃집에 들렀습니다',
    '작은 꽃 한 송이를 사서 집에 가져왔습니다', '지우는 꽃을 물병에 꽂고 즐거운 하루를 마무리했습니다',
  ];
  TL.defaultTexts = defaultTexts;

  // All mutable practice state lives in one object (no bare globals).
  const S = {
    arr: defaultTexts.slice(), index: 0, started: 0, stoppedAt: 0, timer: 0,
    keys: 0, errors: 0, pastes: 0, finished: false, points: [],
    composing: false, lastCommitted: '', sentenceStart: 0, sentenceTimes: [], mistakes: new Map(),
  };
  TL.S = S;

  const input = () => $('typing');

  // ---- metrics -------------------------------------------------------------
  function correctStrokes() {
    if (S.finished) return S.arr.join('').split('').reduce((n, c) => n + TL.countStroke(c), 0);
    let total = S.arr.slice(0, S.index).join('').split('').reduce((n, c) => n + TL.countStroke(c), 0);
    const value = input().value;
    for (let i = 0; i < value.length; i++) if (value[i] === S.arr[S.index]?.[i]) total += TL.countStroke(value[i]);
    return total;
  }
  function calc() {
    const ms = S.started ? Math.max(1, (S.stoppedAt || performance.now()) - S.started) : 1;
    return {
      elapsed: Math.floor(ms / 1000),
      speed: S.started ? Math.round((correctStrokes() * 60000) / ms) : 0,
      accuracy: S.keys ? Math.max(0, Math.round(100 * (1 - S.errors / S.keys))) : 100,
    };
  }
  TL.calc = calc;

  // ---- chart (hi-DPI, crisp on phones) ------------------------------------
  function drawChart() {
    const canvas = $('chart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 850,
      cssH = canvas.clientHeight || 170;
    if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    const max = Math.max(100, ...S.points.map((p) => p[1])) * 1.2;
    // grid + y labels
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#34516c';
    ctx.fillStyle = '#7f93ab';
    ctx.font = '11px system-ui';
    for (let g = 0; g <= 4; g++) {
      const y = 12 + ((cssH - 24) * g) / 4;
      ctx.beginPath();
      ctx.moveTo(34, y);
      ctx.lineTo(cssW - 8, y);
      ctx.stroke();
      ctx.fillText(String(Math.round((max * (4 - g)) / 4)), 2, y + 4);
    }
    if (!S.points.length) return;
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#60a5fa';
    S.points.forEach((p, i) => {
      const x = 36 + (cssW - 48) * (i / Math.max(1, S.points.length - 1));
      const y = cssH - 12 - (p[1] * (cssH - 24)) / max;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  TL.drawChart = drawChart;

  // ---- rendering -----------------------------------------------------------
  function displaySentence() {
    if (S.finished) return;
    const target = S.arr[S.index] || '',
      value = input().value;
    let html = '';
    for (let i = 0; i < target.length; i++) {
      const cls = i < value.length ? (value[i] === target[i] ? 'good' : 'wrong') : i === value.length ? 'cursor' : '';
      html += '<span class="' + cls + '">' + TL.esc(target[i]) + '</span>';
    }
    $('source').innerHTML = html;
    $('count').textContent = 'Câu ' + (S.index + 1) + ' / ' + S.arr.length;
    // next key the learner should press
    TL.highlightKey(value.length < target.length ? target[value.length] : '');
  }

  function stats() {
    if (!S.started) return;
    const c = calc();
    $('t').textContent = TL.clock(c.elapsed);
    $('s').textContent = c.speed;
    $('a').textContent = c.accuracy + '%';
    // compact live bar that stays in view above the input on small screens
    const mt = $('mt'), ms = $('ms'), ma = $('ma');
    if (mt) mt.textContent = TL.clock(c.elapsed);
    if (ms) ms.textContent = c.speed + ' 타';
    if (ma) ma.textContent = c.accuracy + '%';
    const total = S.arr.join('').length;
    const done = S.finished
      ? total
      : S.arr.slice(0, S.index).join('').length + Math.min(S.arr[S.index]?.length || 0, input().value.length);
    const p = Math.min(100, Math.round((done / Math.max(1, total)) * 100));
    $('p').textContent = p + '%';
    $('fill').style.width = p + '%';
    if (c.elapsed > 0 && c.elapsed % 2 === 0 && S.points.at(-1)?.[0] !== c.elapsed) {
      S.points.push([c.elapsed, c.speed]);
      drawChart();
    }
  }
  TL.stats = stats;

  // ---- input handling ------------------------------------------------------
  function beginTyping() {
    if (!S.started) {
      S.started = performance.now();
      S.sentenceStart = S.started;
      S.timer = setInterval(stats, 250);
    }
  }
  TL.beginTyping = beginTyping;

  function isComplete(value, target) {
    if (value === target) return true;
    // Whole sentence typed, plus trailing whitespace used to finalise the last
    // syllable (Space/Enter). That trailing whitespace is NOT an error.
    return value.length > target.length && value.slice(0, target.length) === target && value.slice(target.length).trim() === '';
  }

  function recordMistake(ch) {
    if (/\s/.test(ch)) return;
    S.mistakes.set(ch, (S.mistakes.get(ch) || 0) + 1);
  }

  function advance() {
    const now = performance.now();
    S.sentenceTimes.push({ text: S.arr[S.index], ms: now - S.sentenceStart });
    S.sentenceStart = now;
    S.index++;
    S.lastCommitted = '';
    input().value = '';
    if (S.index === S.arr.length) {
      finish();
      return;
    }
    displaySentence();
  }

  function commitInput() {
    if (S.finished || S.composing) return;
    let value = TL.nfc(input().value);
    // Strip whitespace that bleeds into the START of a fresh sentence (the
    // Space/Enter that finalised the previous sentence's last syllable).
    if (S.lastCommitted === '' && /^\s/.test(value)) value = value.replace(/^\s+/, '');
    if (value !== input().value) input().value = value;

    const target = S.arr[S.index] ?? '';
    let prefix = 0;
    while (prefix < S.lastCommitted.length && prefix < value.length && S.lastCommitted[prefix] === value[prefix]) prefix++;
    let suffix = 0;
    while (suffix < S.lastCommitted.length - prefix && suffix < value.length - prefix && S.lastCommitted.at(-1 - suffix) === value.at(-1 - suffix)) suffix++;
    const end = value.length - suffix;
    for (let i = prefix; i < end; i++) {
      if (i < target.length) {
        S.keys++;
        if (value[i] !== target[i]) {
          S.errors++;
          recordMistake(target[i]);
        }
      } else if (!/\s/.test(value[i])) {
        // extra non-space typing past the sentence end is a genuine error;
        // extra whitespace is the finalise keystroke and is ignored.
        S.keys++;
        S.errors++;
      }
    }
    S.lastCommitted = value;
    displaySentence();
    if (isComplete(value, target)) advance();
    stats();
  }
  TL.commitInput = commitInput;

  function reset() {
    clearInterval(S.timer);
    Object.assign(S, {
      index: 0, started: 0, stoppedAt: 0, keys: 0, errors: 0, pastes: 0,
      finished: false, points: [], composing: false, lastCommitted: '',
      sentenceStart: 0, sentenceTimes: [], mistakes: new Map(),
    });
    const el = input();
    el.disabled = false;
    el.value = '';
    $('t').textContent = '00:00';
    $('s').textContent = '0';
    $('a').textContent = '100%';
    $('p').textContent = '0%';
    $('fill').style.width = '0';
    $('mt').textContent = '00:00';
    $('ms').textContent = '0 타';
    $('ma').textContent = '100%';
    $('completion').classList.add('hidden');
    displaySentence();
    drawChart();
  }
  TL.reset = reset;

  function setLesson(sentences) {
    const clean = sentences.map(TL.cleanLine).filter(Boolean);
    S.arr = clean.length ? clean : defaultTexts.slice();
    reset();
  }
  TL.setLesson = setLesson;

  // ---- completion + session summary ---------------------------------------
  function finish() {
    S.stoppedAt = performance.now();
    S.finished = true;
    clearInterval(S.timer);
    stats();
    input().disabled = true;
    $('p').textContent = '100%';
    $('fill').style.width = '100%';
    const c = calc();
    TL.saveRecord({
      date: new Date().toISOString(), duration: c.elapsed, speed: c.speed, accuracy: c.accuracy,
      pasteCount: S.pastes, metricVersion: 2, metric: 'target-strokes', lesson: TL.currentLessonName || 'Bài luyện',
    });
    const slowest = S.sentenceTimes.slice().sort((a, b) => b.ms - a.ms)[0];
    const topMiss = [...S.mistakes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    let html =
      '<h2>Hoàn thành bài luyện</h2><p>' + TL.clock(c.elapsed) + ' · ' + c.speed + ' 타/phút · ' +
      c.accuracy + '% · Dán ' + S.pastes + ' lần</p>';
    if (slowest) html += '<p class="muted">Câu chậm nhất: “' + TL.esc(slowest.text) + '” — ' + (slowest.ms / 1000).toFixed(1) + ' giây.</p>';
    if (topMiss.length)
      html +=
        '<p class="muted">Hay gõ sai: ' +
        topMiss.map(([ch, n]) => '<b class="miss">' + TL.esc(ch) + '</b> ×' + n).join(' · ') +
        '</p>';
    else if (S.keys) html += '<p class="muted ok">Không có ký tự nào bị gõ sai. 👏</p>';
    $('completion').innerHTML = html;
    $('completion').classList.remove('hidden');
    TL.renderProgress && TL.renderProgress();
  }
  TL.finish = finish;

  // Wiring is done once the DOM is ready (ui.js calls TL.initPractice).
  TL.initPractice = function () {
    const el = input();
    $('reset').onclick = reset;
    $('apply').onclick = () => {
      TL.currentLessonName = 'Bài tự nhập';
      const lines = $('custom').value.split(/\r?\n/);
      setLesson(lines);
      TL.saveCustom($('custom').value);
    };
    el.addEventListener('paste', () => { if (!S.finished) S.pastes++; });
    el.addEventListener('drop', () => { if (!S.finished) S.pastes++; }); // 2.3 missed drag-drop
    el.addEventListener('compositionstart', () => { S.composing = true; beginTyping(); });
    el.addEventListener('compositionend', () => { S.composing = false; commitInput(); });
    el.addEventListener('input', (e) => {
      if (S.finished) return;
      beginTyping();
      if (e.isComposing || S.composing) return;
      commitInput();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !S.composing && !e.isComposing) {
        e.preventDefault();
        commitInput(); // advances if the sentence is already complete
      }
    });
    let resizeT;
    window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(drawChart, 150); });
  };
})(window.TL);
