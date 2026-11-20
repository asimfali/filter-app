---
name: frontend-structure
description: Остальные структурные особенности tmdata-фронтенда — восстановление сессии и "resume where you left off", стилизация Tailwind, карта src/ и legacy-сборка под старые браузеры. Читать перед добавлением новой страницы, хранилища или работы со стилями.
---
### Sessions / "resume where you left off"

`src/api/sessions.js` + `AuthContext.activeSession`: on login, the backend may return an in-progress
session (currently only `spec-editor`, keyed by `data.page`); `App.jsx` restores it by jumping straight to
that page with the saved product ids / changes. Extend the `useEffect` in `MainApp` that switches on
`data.page` when adding session resumption for a new page.

### Styling

Tailwind CSS v4 (via `@tailwindcss/vite`, not the old PostCSS plugin), class-based dark mode
(`darkMode: 'class'`, toggled by `ThemeContext` adding/removing `.dark` on `<html>`, default is **dark**).
`src/utils/styles.js` holds shared class strings like `inputCls` — reuse these instead of re-declaring
input styling per component. Most UI text/labels are Russian; keep new UI copy consistent with that.

### Other structural notes

- `src/contexts/` — one provider per cross-cutting concern (`Auth`, `Theme`, `Issues`, `Notifications`, `Cart`);
  they're nested in `App.jsx`'s `AppInner`/`App`. `NotificationsProvider`/`IssuesProvider`/`CartProvider` are
  only mounted once a user is logged in.
- `src/hooks/` — reusable data-fetching/state hooks (`useSeriesMaster`, `useBatchStages`, `useColumnPrefs`,
  `useDocUpload`/`useProductDocUpload`, `useExcelImport`, `useMultiSelect`), generally paired with a specific
  page/domain rather than being generic.
- `src/components/common/` — cross-domain UI primitives (`Modal`, `ConfirmModal`, `AlertModal`, `Dropdown`,
  `SmartSelect`, `FileDropZone`, `WarningsList`). `SmartSelect` is the standard async search/select-with-inline-create
  component — prefer it over building new search inputs. `useModals.jsx` gives a hook-based
  `confirm()`/`alert()` API backed by `ConfirmModal`/`AlertModal`.
- `src/components/<domain>/` (`auth`, `bom`, `catalog`, `configurator`, `issues`, `media`, `plm`, `selection`,
  `sync`) hold components specific to that backend app; `src/pages/` are the top-level page components wired
  into `App.jsx`'s `MainApp`, with some larger domains (`bom`) further split into `src/pages/bom/`.
- `src/status/SPEC_EDITOR_FRONTEND_PROGRESS.md` documents the BOM/spec-editor refactor (component layout,
  known limitations — e.g. PDF downloads go through a blob URL because the bearer token can't be passed to
  `window.open`, and `STATUS_LABEL`/`STATUS_COLOR` are still duplicated between `SpecList`/`SpecEditor`).
  Worth reading before touching `src/pages/bom/` or `PartEditorPage.jsx`.
- Legacy browser support matters: `vite-plugin-legacy` targets down to Chrome 49/Firefox 52/Edge 18
  (see `browserslist` in `package.json` and `vite.config.js`), so avoid relying on very recent JS/CSS syntax
  without checking it's covered by the legacy build's polyfills/transpilation.
