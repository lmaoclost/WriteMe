# ADR-0009 — Bilingual UI: English and Brazilian Portuguese

## Context
The app shipped with mixed copy: most screens were EN, the Bindery carried PT strings (ADR-0008), and several panels had PT aria-labels and placeholders. The UI needs one language at a time, switchable without reload, and the exported book must follow the language the writer sees. World content (entries, demo seed, world and chapter names) is user data and stays as typed.

## Decision
1. **Library:** `i18next` + `react-i18next`, resources bundled at build time. No HTTP backend and no network request at runtime.
2. **Locales:** `src/i18n/locales/en.json` is the key source; `pt-BR.json` mirrors it. `src/i18n/i18next.d.ts` types `t()` to the EN key union, and a parity test fails when a key exists in one file only.
3. **Control:** one toggle button in the Library header and in the workspace sidebar. It shows the target language (`PT` while EN is active), uses the `Languages` icon, and carries an action `aria-label`. No dropdown, no segmented control, no browser detection.
4. **Default:** EN on first load. The choice persists in `localStorage` under `scriptorium.lang`, separate from the `scriptorium.v1` schema and from the JSON backup.
5. **Dates:** formatted with `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat` from the active locale. No hardcoded month or relative-time strings.
6. **Exports:** print, EPUB, and DOCX follow the language active at export time. That covers `Contents`, `Glossary`, `About the author`, `Colophon`, copyright lines, chapter numbering words, the empty-chapter placeholder, and the EPUB `dc:language`.
7. **Generated content:** codex templates and generated names (for example a new timeline era) are written in the language active at creation. Existing entries are never retranslated.
8. **Stored values stay English:** enum values and data keys (`ConnectionType`, oath status/kind, calendar event categories, conlang part of speech, bindery preset ids) remain stable. Only the visible label is translated, through `labelKey` maps or explicit helpers.
9. **Category lexicon:** labels, taglines, section names, and field names live in `categories.*` in both locales; `categoryLabel`, `codexCategoryChips`, and `templateSections` read the locale for the active language.
10. **Terminology:** Entry is **Verbete** in PT. The other approved labels are in `docs/glossary.md`.

## Consequences
- Tests run in EN by default (`src/test/setup.ts`); each translated area keeps at least one PT smoke test.
- Modules outside React (stores, export builders, undo action) call `i18n.t` imported from `src/i18n`, so no component context is required.
- UI text added later must land in both locale files; the parity test catches drift.
- The Bindery PT leak noted in ADR-0008 is resolved by the shared catalog rather than by rewriting copy per component.

## Status
Accepted — 2026-10-19, implementation session with Renan.
