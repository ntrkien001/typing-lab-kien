/* Typing Lab 2.4 — PWA registration + keyboard toggle.
 * Service workers only run over http(s); opening the file directly (file://)
 * simply skips registration and the app still works fully offline-capable once
 * hosted. */
(function (TL) {
  'use strict';
  const $ = TL.$;

  function wireKeyboardToggle() {
    const toggle = $('kbToggle'),
      kb = $('keyboard');
    if (!toggle || !kb) return;
    const apply = () => kb.classList.toggle('hidden', !toggle.checked);
    toggle.addEventListener('change', apply);
    apply();
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.protocol !== 'http:') return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { wireKeyboardToggle(); registerSW(); });
  else { wireKeyboardToggle(); registerSW(); }
})(window.TL);
