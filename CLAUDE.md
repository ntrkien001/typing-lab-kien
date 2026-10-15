# Typing Lab — project instructions

## Context
- Owner: Kiên. Reply in concise Vietnamese; explain material bugs directly.
- Current application version: 2.4.1. Public URL: https://typing-lab-kien.vercel.app (2.3 live until 2.4 is deployed).
- Claude is a development assistant. This project has no AI runtime, server, API key, or account system.
- This archive is a source handoff; it does not grant deployment access or connect the user's Claude account.

## Architecture (2.4)
- `src/` holds the app split into modules, all attached to one global namespace `window.TL`:
  - `core.js`: helpers (`$`, `clock`, `esc`, `nfc`, `stripInvisible`, `cleanLine`).
  - `hangul.js`: `countStroke`, syllable decomposition, jamo tables.
  - `keyboard.js`: on-screen 두벌식 keyboard + next-key highlight.
  - `practice.js`: typing engine, metrics, chart, session summary (state in `TL.S`).
  - `history.js`: on-device history, CSV, daily progress chart, custom-lesson persistence.
  - `lesson.js`: file import (`inspect`), sandboxed preview, `buildExport`; lazy-loads Acorn.
  - `ui.js`: tabs, settings persistence, file editor wiring, demo, boot.
  - `pwa.js`: service-worker registration, keyboard toggle.
- `vendor/acorn.js`: Acorn 8.15.0, MIT. Loaded on demand (only the editor tab needs it). Do not read it fully into context or modify it for normal changes.
- Edit source files, then build. Do not hand-edit generated `dist/`.

## Commands
- `npm ci` installs dev test deps (linkedom) from the lockfile.
- `npm test` runs DOM integration checks (linkedom, not a real browser or hardware IME).
- `npm run build` writes `dist/` (inlined `index.html` + lazy `vendor/acorn.js` + PWA assets) and asserts the inlining happened.
- `node tests/e2e.mjs` runs real-Chromium checks incl. simulated Korean IME (optional; needs Playwright).
- Open root `index.html` for development or `dist/index.html` for the standalone output.

## Preserve application behavior
- Normalize Hangul to NFC; do not score or advance while an IME composition is active.
- Treat the Space/Enter used to finalise the last syllable as a confirm key, not an error; strip whitespace that bleeds into the start of the next sentence.
- Stroke estimates use 두벌식 and count compound vowels/finals; Shift is not a separate stroke. Keep character/minute distinct from estimated stroke/minute. Freeze scores when a session completes.
- Keep old history compatible; distinguish old metrics and sessions containing paste events; never let a corrupted localStorage value throw.
- Never execute uploaded HTML/JavaScript to extract lesson content. Use Acorn AST + inert DOM parsing. Preview only in the sandboxed iframe; escape dynamic content everywhere (history uses escaped fields).
- Exports must preserve the original input and carry a mandatory, non-removable mode label. Enabling copy/paste, the length condition, or auto-fill all count as assistance and must be labelled; simulated results must be labelled as simulated. Do not make simulated or assisted output resemble a genuine measured result, and do not remove or weaken these labels.

## Working style and verification
- Follow the user's bounded task; inspect relevant source first and make focused edits.
- No backend or new service unless the user requests it. Avoid new dependencies when vanilla JS suffices.
- Run `npm test` and `npm run build` after code changes. Add tests for meaningful new behavior rather than copying implementation logic.
- Report observed results accurately; do not claim full browser or Korean hardware IME QA from DOM tests alone. Any newly discovered issue is a finding to verify, not a confirmed bug until supported by evidence.

## Deployment context
- Verify the current project and authenticated scope before deployment; never deploy to an unrelated account or create a duplicate as an error workaround.
- Deployment requires the user's authenticated Vercel tooling. No credentials are included in this package.
- These IDs are not secrets, but if the repo is made public you may move them to `CLAUDE.local.md` (already git-ignored).
