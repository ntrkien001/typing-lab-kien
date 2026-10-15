/* Typing Lab 2.4 — on-device history, CSV export, progress chart.
 * All reads are defensive: a corrupted localStorage value must never throw
 * (2.3 crashed in finish() when the stored value was not an array). */
(function (TL) {
  'use strict';
  const $ = TL.$;
  const HKEY = 'typinglab_history';
  const CUSTOM_KEY = 'typinglab_custom_v24';

  function loadHistory() {
    try {
      const v = JSON.parse(localStorage.getItem(HKEY) || '[]');
      return Array.isArray(v) ? v.filter((r) =>
        r && typeof r === 'object' && !Array.isArray(r) &&
        typeof r.date === 'string' && Number.isFinite(new Date(r.date).getTime())
      ) : [];
    } catch {
      return [];
    }
  }
  TL.loadHistory = loadHistory;

  TL.saveRecord = function (record) {
    const h = loadHistory();
    h.unshift(record);
    try {
      localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 200)));
    } catch {
      /* storage full or blocked — keep the in-session result anyway */
    }
  };

  TL.saveCustom = function (text) {
    try {
      localStorage.setItem(CUSTOM_KEY, text || '');
    } catch {}
  };
  TL.loadCustom = function () {
    try {
      return localStorage.getItem(CUSTOM_KEY) || '';
    } catch {
      return '';
    }
  };

  function renderHistory() {
    const h = loadHistory();
    if (!h.length) {
      $('historyList').textContent = 'Chưa có dữ liệu';
      return;
    }
    // Build with escaped fields (2.3 used innerHTML with an unescaped speed field).
    $('historyList').innerHTML = h
      .map((x) => {
        const tag =
          (x.metricVersion === 2 ? ' [타 văn bản]' : ' [cách tính cũ]') + (x.pasteCount ? ' [có dán]' : '');
        return (
          '<div class="historyitem">' +
          TL.esc(x.lesson || 'Bài luyện') + TL.esc(tag) + ' — ' +
          TL.clock(x.duration) + ' — ' + TL.esc(String(x.speed)) + ' 타/phút — ' +
          TL.esc(String(x.accuracy)) + '% — ' +
          TL.esc(new Date(x.date).toLocaleString('vi-VN')) +
          '</div>'
        );
      })
      .join('');
    renderProgress();
  }
  TL.renderHistory = renderHistory;

  // Daily best speed over the most recent 14 active days.
  function renderProgress() {
    const canvas = $('progress');
    if (!canvas) return;
    const byDay = new Map();
    for (const r of loadHistory()) {
      if (r.metricVersion !== 2) continue; // only compare like-for-like metrics
      const day = new Date(r.date).toISOString().slice(0, 10);
      byDay.set(day, Math.max(byDay.get(day) || 0, Number(r.speed) || 0));
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-14);
    const label = $('progressLabel');
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cssW = canvas.clientWidth || 850,
      cssH = canvas.clientHeight || 150;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    if (days.length < 2) {
      if (label) label.textContent = 'Cần ít nhất 2 ngày luyện để vẽ biểu đồ tiến bộ.';
      return;
    }
    if (label)
      label.textContent =
        'Tốc độ tốt nhất mỗi ngày (타/phút) · ' + days[0][0] + ' → ' + days.at(-1)[0];
    const max = Math.max(...days.map((d) => d[1])) * 1.2 || 100;
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#34516c';
    ctx.fillStyle = '#7f93ab';
    ctx.font = '11px system-ui';
    for (let g = 0; g <= 4; g++) {
      const y = 12 + ((cssH - 36) * g) / 4;
      ctx.beginPath();
      ctx.moveTo(34, y);
      ctx.lineTo(cssW - 8, y);
      ctx.stroke();
      ctx.fillText(String(Math.round((max * (4 - g)) / 4)), 2, y + 4);
    }
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#6be6aa';
    days.forEach((d, i) => {
      const x = 36 + (cssW - 48) * (i / Math.max(1, days.length - 1));
      const y = cssH - 24 - (d[1] * (cssH - 36)) / max;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    });
    ctx.stroke();
  }
  TL.renderProgress = renderProgress;

  function save(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  TL.saveBlob = save;

  TL.initHistory = function () {
    $('clear').onclick = () => {
      if (confirm('Xóa lịch sử?')) {
        try {
          localStorage.removeItem(HKEY);
        } catch {}
        renderHistory();
      }
    };
    $('savecsv').onclick = () => {
      const esc = (s) => {
        s = String(s ?? '');
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const rows = [
        'date,lesson,duration,speed,accuracy,paste_count,metric_version',
        ...loadHistory().map((x) =>
          [x.date, esc(x.lesson || 'Bài luyện'), x.duration, x.speed, x.accuracy, x.pasteCount || 0, x.metricVersion || 1]
            .join(',')
        ),
      ];
      save(new Blob(['﻿' + rows.join('\n')], { type: 'text/csv' }), 'typing-history.csv');
    };
  };
})(window.TL);
