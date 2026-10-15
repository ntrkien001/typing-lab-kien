/* Typing Lab 2.4 — core helpers.
 * Everything hangs off a single global namespace `TL` so the app no longer
 * leaks 20+ bare globals onto `window` (2.3 defined `function history()`, which
 * shadowed window.history and broke the History API). */
window.TL = window.TL || {};
(function (TL) {
  'use strict';

  TL.VERSION = '2.4.1';
  TL.$ = (id) => document.getElementById(id);

  // mm:ss from a number of seconds (clamped at 0).
  TL.clock = (n) => {
    n = Math.max(0, Math.floor(n));
    return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
  };

  // Escape every character that is unsafe inside HTML text OR an attribute.
  // 2.3 escaped <, > and & only; history rendering used innerHTML, so a crafted
  // value (e.g. imported later) could inject markup. We escape quotes too.
  TL.esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  TL.nfc = (s) => String(s).normalize('NFC');

  // Remove zero-width characters and turn non-breaking spaces into normal ones.
  // These are invisible but make a typed sentence impossible to match (bug: a
  // custom line pasted from the web could never be completed).
  TL.stripInvisible = (s) =>
    String(s).replace(/[​-‍⁠﻿]/g, '').replace(/ /g, ' ');

  // Normalise a single lesson sentence: NFC, strip invisibles, trim edges.
  // Typing targets never legitimately start or end with whitespace.
  TL.cleanLine = (s) => TL.stripInvisible(TL.nfc(s)).trim();

  TL.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
})(window.TL);
