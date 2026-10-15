/* Typing Lab 2.4 — Hangul syllable maths.
 * Decomposes 가-힣 syllables into initial (lead) / vowel (jung) / final (jong)
 * and estimates 두벌식 keystrokes. Used by the metrics and the on-screen keyboard. */
(function (TL) {
  'use strict';

  const SBASE = 0xac00,
    SLAST = 0xd7a3,
    VCOUNT = 21,
    TCOUNT = 28;

  // Compatibility jamo, indexed exactly as Unicode orders the modern jamo.
  const LEADS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  const VOWELS = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
  const TAILS = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  // Vowels and finals that cost two keystrokes on 두벌식 (compound jamo).
  const jungDouble = new Set([9, 10, 11, 14, 15, 16, 19]); // ㅘㅙㅚㅝㅞㅟㅢ
  const jongDouble = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]); // ㄳㄵㄶㄺ…ㅄ

  function decompose(cp) {
    const x = cp - SBASE;
    return { l: Math.floor(x / (VCOUNT * TCOUNT)), v: Math.floor((x % (VCOUNT * TCOUNT)) / TCOUNT), t: x % TCOUNT };
  }

  TL.isHangulSyllable = (cp) => cp >= SBASE && cp <= SLAST;

  // Estimated 두벌식 keystrokes for one character. Identical results to 2.3:
  // base 2 (lead+vowel) + 1 per compound vowel + 1 if a final exists + 1 more
  // if that final is a compound. Shift is not counted as a separate stroke.
  TL.countStroke = function (ch) {
    const cp = ch.codePointAt(0);
    if (!TL.isHangulSyllable(cp)) return 1;
    const { v, t } = decompose(cp);
    return 2 + (jungDouble.has(v) ? 1 : 0) + (t ? 1 : 0) + (jongDouble.has(t) ? 1 : 0);
  };

  // Split a syllable into its jamo pieces (for the keyboard's next-key hint).
  TL.jamoOf = function (ch) {
    const cp = ch.codePointAt(0);
    if (!TL.isHangulSyllable(cp)) return null;
    const { l, v, t } = decompose(cp);
    return { lead: LEADS[l], vowel: VOWELS[v], tail: TAILS[t] || '' };
  };

  TL.LEADS = LEADS;
  TL.VOWELS = VOWELS;
  TL.TAILS = TAILS;
})(window.TL);
