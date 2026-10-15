/* Typing Lab 2.4 — on-screen 두벌식 keyboard.
 * Renders the standard 2-set Korean layout and highlights the key(s) needed to
 * type the next character. A learning aid for Vietnamese users new to the
 * Korean keyboard; it is purely visual and never types for the user. */
(function (TL) {
  'use strict';

  // Base jamo -> physical QWERTY key (lower = unshifted, UPPER = needs Shift).
  const JAMO_KEY = {
    ㅂ: 'q', ㅈ: 'w', ㄷ: 'e', ㄱ: 'r', ㅅ: 't', ㅛ: 'y', ㅕ: 'u', ㅑ: 'i', ㅐ: 'o', ㅔ: 'p',
    ㅁ: 'a', ㄴ: 's', ㅇ: 'd', ㄹ: 'f', ㅎ: 'g', ㅗ: 'h', ㅓ: 'j', ㅏ: 'k', ㅣ: 'l',
    ㅋ: 'z', ㅌ: 'x', ㅊ: 'c', ㅍ: 'v', ㅠ: 'b', ㅜ: 'n', ㅡ: 'm',
    ㅃ: 'Q', ㅉ: 'W', ㄸ: 'E', ㄲ: 'R', ㅆ: 'T', ㅒ: 'O', ㅖ: 'P',
  };
  // Compound jamo -> sequence of base jamo that produce them.
  const COMPOUND = {
    ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
    ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ',
    ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
  };

  const ROWS = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];
  // For each key, the unshifted and shifted jamo printed on the cap.
  const CAP = {};
  for (const [jamo, key] of Object.entries(JAMO_KEY)) {
    const k = key.toLowerCase();
    CAP[k] = CAP[k] || { base: '', shift: '' };
    if (key === k) CAP[k].base = jamo;
    else CAP[k].shift = jamo;
  }

  // The physical keys (lowercase) required to type one jamo, in order.
  function keysForJamo(jamo) {
    const seq = COMPOUND[jamo] || jamo;
    const keys = [];
    for (const j of seq) {
      const k = JAMO_KEY[j];
      if (k) keys.push(k.toLowerCase());
    }
    return keys;
  }

  // All physical keys needed to type one character, in order.
  TL.keysForChar = function (ch) {
    const jamo = TL.jamoOf(ch);
    if (!jamo) {
      if (ch === ' ') return ['space'];
      const low = ch.toLowerCase();
      return JAMO_KEY[ch] ? [JAMO_KEY[ch].toLowerCase()] : /[a-z0-9]/.test(low) ? [low] : [];
    }
    return [...keysForJamo(jamo.lead), ...keysForJamo(jamo.vowel), ...(jamo.tail ? keysForJamo(jamo.tail) : [])];
  };

  let built = false;
  function build() {
    const host = TL.$('keyboard');
    if (!host || built) return;
    built = true;
    const frag = document.createDocumentFragment();
    for (const row of ROWS) {
      const r = document.createElement('div');
      r.className = 'kbRow';
      for (const k of row) {
        const key = document.createElement('div');
        key.className = 'kbKey';
        key.dataset.key = k;
        const cap = CAP[k] || { base: '', shift: '' };
        key.innerHTML =
          (cap.shift ? '<span class="kbShift">' + TL.esc(cap.shift) + '</span>' : '') +
          '<span class="kbBase">' + TL.esc(cap.base || '') + '</span>';
        r.appendChild(key);
      }
      frag.appendChild(r);
    }
    const spaceRow = document.createElement('div');
    spaceRow.className = 'kbRow';
    const space = document.createElement('div');
    space.className = 'kbKey kbSpace';
    space.dataset.key = 'space';
    space.textContent = 'space';
    spaceRow.appendChild(space);
    frag.appendChild(spaceRow);
    host.appendChild(frag);
  }

  // Highlight the keys needed for `ch`. The first key gets a stronger "next" cue.
  TL.highlightKey = function (ch) {
    build();
    const host = TL.$('keyboard');
    if (!host) return;
    host.querySelectorAll('.kbKey').forEach((el) => el.classList.remove('next', 'soon'));
    if (!ch) return;
    const keys = TL.keysForChar(ch);
    keys.forEach((k, i) => {
      const el = host.querySelector('.kbKey[data-key="' + k + '"]');
      if (el) el.classList.add(i === 0 ? 'next' : 'soon');
    });
  };

  TL.buildKeyboard = build;
})(window.TL);
