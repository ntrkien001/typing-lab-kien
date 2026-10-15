/* Typing Lab 2.4 — UI wiring: tabs, settings, file editor, demo, init. */
(function (TL) {
  'use strict';
  const $ = TL.$;

  // ---- tabs ----------------------------------------------------------------
  function initTabs() {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    tabs.forEach((b) => {
      b.onclick = () => {
        tabs.forEach((x) => {
          const on = x === b;
          x.classList.toggle('active', on);
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          x.tabIndex = on ? 0 : -1;
        });
        document.querySelectorAll('.view').forEach((x) => x.classList.toggle('active', x.id === b.dataset.tab));
        if (b.dataset.tab === 'history') TL.renderHistory();
        if (b.dataset.tab === 'editor') TL.loadAcorn().catch(() => {}); // warm up on open
      };
      // arrow-key navigation between tabs
      b.addEventListener('keydown', (e) => {
        const i = tabs.indexOf(b);
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
          next.focus();
          next.click();
        }
      });
    });
  }

  // ---- editor: settings persistence ----------------------------------------
  const settingIds = ['em', 'es', 'ev', 'ea', 'simulate', 'condition', 'copy', 'assist', 'key', 'referenceSpeed', 'unit'];
  const defaults = { em: '7', es: '36', ev: '324', ea: '100', simulate: false, condition: 'strict', copy: 'yes', assist: false, key: 'F8', referenceSpeed: '220', unit: 'strokes' };
  TL.defaults = defaults;
  // Data key is independent of the app version so upgrading to 2.5 keeps settings.
  const SETTINGS_KEY = 'typinglab_editor_v23';

  function applySettings(data) {
    for (const id of settingIds) {
      const el = $(id),
        value = data[id];
      if (value === undefined || !el) continue;
      if (el.type === 'checkbox') {
        if (typeof value === 'boolean') el.checked = value;
      } else if (el.tagName === 'SELECT') {
        if ([...el.options].some((o) => o.value === String(value))) el.value = value;
      } else if (typeof value === 'string' || typeof value === 'number') el.value = value;
    }
    $('assistOpt').classList.toggle('hidden', !$('assist').checked);
    preview();
  }
  TL.applySettings = applySettings;

  function saveSettings() {
    try {
      localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(Object.fromEntries(settingIds.map((id) => [id, $(id).type === 'checkbox' ? $(id).checked : $(id).value])))
      );
      $('settingsStatus').textContent = 'Đã lưu cấu hình trên thiết bị này.';
    } catch {
      $('settingsStatus').textContent = 'Trình duyệt không cho lưu cấu hình; vẫn có thể dùng và xuất file.';
    }
  }
  TL.saveSettings = saveSettings;

  // ---- editor: calculations ------------------------------------------------
  function readCfg() {
    const m = +$('em').value,
      s = +$('es').value,
      v = +$('ev').value,
      a = +$('ea').value;
    if (![m, s, v, a].every(Number.isInteger) || m < 0 || m > 999 || s < 0 || s > 59 || v < 1 || v > 2000 || a < 0 || a > 100 || m * 60 + s === 0)
      throw Error('Thời gian phải lớn hơn 0; tốc độ 1–2000; chính xác 0–100%.');
    return { seconds: m * 60 + s, time: TL.clock(m * 60 + s), speed: v, accuracy: a };
  }

  function units() {
    return $('unit').value === 'chars'
      ? { count: TL.uploaded?.total || 0, label: 'ký tự/phút' }
      : { count: TL.uploaded?.strokes || 0, label: '타 ước tính/phút' };
  }

  function analyze() {
    if (!TL.uploaded) return;
    try {
      const c = readCfg(),
        u = units(),
        seconds = (u.count * 60) / c.speed,
        required = Math.round((u.count * 60) / c.seconds);
      $('expectedTime').textContent = TL.clock(Math.round(seconds));
      $('requiredSpeed').textContent = required;
      const dist = Math.abs(seconds - c.seconds) / Math.max(seconds, c.seconds);
      $('checkConsistency').className = dist > 0.12 ? 'bad' : 'ok';
      $('checkConsistency').textContent =
        u.count + ' ÷ ' + c.speed + ' ' + u.label + ' ≈ ' + Math.round(seconds) + ' giây. ' +
        (dist > 0.12 ? 'Thời gian và tốc độ chưa khớp theo đơn vị đã chọn.' : 'Thời gian và tốc độ khớp xấp xỉ.');
      $('unitInfo').textContent =
        $('unit').value === 'strokes'
          ? 'Ước tính thao tác trên 두벌식: nguyên âm kép và phụ âm cuối ghép tính hai phím; Shift không tính riêng. Không gồm sửa lỗi, đọc câu hoặc di chuyển con trỏ.'
          : 'Đếm âm tiết Hàn đã ghép, chữ khác, dấu câu và khoảng trắng; không đếm mã HTML hoặc xuống dòng phân cách câu.';
    } catch (e) {
      $('expectedTime').textContent = '—';
      $('requiredSpeed').textContent = '—';
      $('checkConsistency').textContent = e.message;
      $('checkConsistency').className = 'bad';
    }
  }

  function preview() {
    try {
      const c = readCfg();
      const sim = $('simulate').checked;
      $('pt').textContent = sim ? c.time : 'Đo thực';
      $('pv').textContent = sim ? c.speed + ($('unit').value === 'chars' ? ' ký tự/phút' : '타/phút') : 'Đo thực';
      $('pa').textContent = sim ? c.accuracy + '%' : 'Đo thực';
    } catch {
      $('pt').textContent = '—';
      $('pv').textContent = '—';
      $('pa').textContent = '—';
    }
    analyze();
  }
  TL.preview = preview;

  // ---- editor: file upload -------------------------------------------------
  function initEditor() {
    settingIds.forEach((id) =>
      $(id).addEventListener('change', () => {
        preview();
        $('assistOpt').classList.toggle('hidden', !$('assist').checked);
        saveSettings();
      })
    );
    ['em', 'es', 'ev', 'ea'].forEach((id) => $(id).addEventListener('input', preview));
    $('restoreSettings').onclick = () => {
      applySettings(defaults);
      saveSettings();
    };

    let generation = 0;
    $('file').onchange = async () => {
      const gen = ++generation;
      TL.uploaded = null;
      $('export').disabled = true;
      $('tryLesson').disabled = true;
      $('useLesson').disabled = true;
      $('analysis').classList.add('hidden');
      $('lessonPreview').classList.add('hidden');
      $('lessonFrame').srcdoc = '';
      $('compatibility').textContent = '';
      $('status').textContent = '';
      const f = $('file').files[0];
      if (!f) {
        $('fileState').textContent = 'Chưa chọn file.';
        return;
      }
      $('fileState').textContent = 'Đang phân tích ' + f.name + '…';
      try {
        if (f.size > 2 * 1024 * 1024) throw Error('File vượt 2 MB. Hãy chọn HTML bài luyện gõ nhỏ hơn.');
        await TL.loadAcorn();
        const buf = await f.arrayBuffer();
        if (gen !== generation) return;
        const decoded = TL.decodeFile(buf);
        const data = TL.inspect(decoded.text);
        if (gen !== generation) return;
        TL.uploaded = data;
        TL.currentUploadName = f.name;
        $('analysis').classList.remove('hidden');
        $('lines').textContent = data.nodes.length;
        $('chars').textContent = data.total;
        $('letters').textContent = data.without;
        $('strokes').textContent = data.strokes;
        $('sourceInfo').textContent =
          'Đọc từ: ' + data.origin + '. ' + data.hangul + ' âm tiết Hangul; ' + data.spaces + ' khoảng trắng.' +
          (decoded.charset && decoded.charset !== 'utf-8' ? ' Mã hóa gốc: ' + decoded.charset + ' (đã chuyển sang UTF-8).' : '') +
          (decoded.suspect ? ' ⚠ Có ký tự không đọc được — kiểm tra lại mã hóa file.' : '');
        $('compatibility').className = 'compat';
        $('compatibility').textContent =
          (data.compatible ? '✓ Chỉnh được file gốc. ' : 'Chỉ phân tích và xem thử. ') + data.reason;
        $('fileState').textContent = f.name + ' · ' + Math.round(f.size / 1024) + ' KB · đã phân tích';
        $('export').disabled = !data.compatible;
        $('tryLesson').disabled = false;
        $('useLesson').disabled = false;
        preview();
      } catch (e) {
        if (gen !== generation) return;
        $('fileState').textContent = 'Không đọc được file.';
        $('status').textContent = e.message;
        $('status').className = 'bad';
      }
    };

    $('suggest').onclick = () => {
      if (!TL.uploaded) return;
      const speed = Number($('referenceSpeed').value);
      if (!Number.isInteger(speed) || speed < 1 || speed > 2000) {
        $('status').textContent = 'Tốc độ tham chiếu phải là số nguyên 1–2000.';
        return;
      }
      const seconds = Math.max(1, Math.round((units().count * 60) / speed));
      if (seconds > 59999) {
        $('status').textContent = 'Thời gian vượt giới hạn 999:59. Hãy chia bài nhỏ hơn.';
        return;
      }
      $('em').value = Math.floor(seconds / 60);
      $('es').value = seconds % 60;
      $('ev').value = speed;
      preview();
      saveSettings();
    };

    $('tryLesson').onclick = () => {
      if (!TL.uploaded) return;
      $('lessonFrame').srcdoc = TL.lessonDocument(TL.uploaded.nodes);
      $('lessonPreview').classList.remove('hidden');
    };
    $('useLesson').onclick = () => {
      if (!TL.uploaded) return;
      TL.currentLessonName = TL.currentUploadName || 'Bài từ file';
      $('custom').value = TL.uploaded.nodes.join('\n');
      TL.saveCustom($('custom').value);
      TL.setLesson(TL.uploaded.nodes.slice());
      document.querySelector('[data-tab="practice"]').click();
      $('typing').focus();
    };

    $('export').onclick = () => {
      try {
        if (!TL.uploaded?.compatible) throw Error('File chưa tương thích.');
        const cfg = {
          ...($('simulate').checked ? readCfg() : {}),
          simulate: $('simulate').checked,
          unit: $('unit').value,
          length: $('condition').value === 'length',
          copy: $('copy').value === 'yes',
          assist: $('assist').checked,
          key: $('key').value,
        };
        const source = TL.buildExport(TL.uploaded.source, cfg);
        const name = $('file').files[0].name.replace(/\.html?$/i, '') + (cfg.simulate ? '_simulation' : '_practice') + '.html';
        TL.saveBlob(new Blob([source], { type: 'text/html;charset=utf-8' }), name);
        $('status').textContent = 'Đã xuất ' + name + '. File gốc được giữ nguyên.';
        $('status').className = 'ok';
      } catch (e) {
        $('status').textContent = e.message;
        $('status').className = 'bad';
      }
    };
  }

  // ---- demo tab ------------------------------------------------------------
  function initDemo() {
    const upd = () => {
      $('dtime').textContent = TL.clock(Math.max(0, +$('dm').value));
      $('dspeed').textContent = $('dv').value + '타';
      $('dacc').textContent = $('da').value + '%';
    };
    ['dm', 'dv', 'da'].forEach((id) => ($(id).oninput = upd));
  }

  // ---- boot ----------------------------------------------------------------
  function init() {
    initTabs();
    TL.initPractice();
    TL.initHistory();
    initEditor();
    initDemo();
    TL.buildKeyboard();
    // restore persisted settings + custom lesson
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      applySettings(raw && typeof raw === 'object' ? { ...defaults, ...raw } : defaults);
    } catch {
      applySettings(defaults);
    }
    const custom = TL.loadCustom();
    if (custom) {
      $('custom').value = custom;
      const lines = custom.split(/\r?\n/).map(TL.cleanLine).filter(Boolean);
      if (lines.length) {
        TL.currentLessonName = 'Bài tự nhập';
        TL.setLesson(lines);
      }
    }
    TL.reset();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window.TL);
