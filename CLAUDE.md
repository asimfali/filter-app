# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Project-specific workflow rules (DRY discipline, diff-only edits, no multiple-choice questions) live in
`.claude/CLAUDE.md` — read it, it is not repeated here.

## What this is

Тепломаш ("Teplomash") corporate portal frontend — a React SPA for an internal system covering:
product configuration/filtering (a graph-based selector), BOM/spec editing, PLM stage tracking,
media/document management, sales carts, issue tracking with live chat, and staff/permissions admin.
The UI is entirely in Russian. It's a Vite + React 18 app talking to a separate backend (not in this repo)
over `/api/v1/*` REST endpoints and a `/ws` WebSocket.

## Commands

```bash
npm run dev         # vite dev server on :5173, proxies /api and /media to localhost:8000, /ws to localhost:8001
npm run build       # vite build -> dist/
npm run lint        # eslint .
npm run preview     # preview the production build

# Tests — Vitest + Testing Library (see .claude/skills/frontend-tests/SKILL.md for conventions)
npm test                                             # whole suite (vitest run)
npm run test:watch                                   # watch mode
npx vitest run src/utils/__tests__/permissions.test.js
npx vitest run -t "test name"
```

### Deployment (manual, only when explicitly asked)

- `./prod.sh` — merges the current branch into the local `prod` branch and pushes it to both the `local` and `origin` remotes.
- `deploy_frontend.sh` — meant to run **on the server**: pulls `prod` from the `local` remote, `npm install`s, builds, and rsyncs `dist/` into `/opt/tmdata/frontend/dist`, then reloads nginx.

Never run these unless the user explicitly asks to deploy — they push to shared branches/remotes and touch a production host.

## Справочные репозитории (только чтение)

Эти репозитории лежат рядом, но не входят в текущий проект — открывать их по мере необходимости
(например, чтобы понять формат ответа API, конверт ошибок или RBAC-права на бэкенде), ничего в них не менять.

- `~/develop/drf_catalog_service` — backend этого фронтенда (Django/DRF), `/api/v1/<app>/` эндпоинты
  (`authority`, `catalog`, `external_api`, `media_library`, `bom`, `plm`, `selection`, `sales`, `issues`).
  Источник permission-кодов (`RBACService`), формата ответа (`{"success": ..., "data"/"error": ...}`) и
  WebSocket-протокола `apps.issues` (Channels/Daphne, порт 8001), который потребляет `useIssuesSocket.js`.
  Его собственный `CLAUDE.md`/`.claude/CLAUDE.md` документируют backend-инварианты и ссылаются на этот
  репозиторий (`~/develop/filter-app`) так же, только-на-чтение, в обратную сторону.

## Architecture

### Routing — no router library

There is no `react-router`. `src/App.jsx`'s `MainApp` keeps a `page` string in state and does manual
`window.history.pushState`/`popstate` handling, driven by `handleNavigate(page, payload)`. Adding a page means:
1. adding a case to the big `{page === '...' && <...Page />}` block in `MainApp`,
2. wiring a `handleNavigate('new-page', payload)` call from wherever it's triggered (usually `Header`),
3. if the page needs deep-linking/refresh survival, persisting the payload to `sessionStorage` the way
   `selectedProductId` / `selectedThreadId` / `specPreviewProductIds` do.

`configurator` (the `FilterTree` graph, see below) is the default/home page and, along with `product`,
is one of the two pages accessible before `user.is_confirmed` (see `PUBLIC_PAGES` in `App.jsx`).

### Auth

`src/api/auth.js` stores JWTs in `localStorage` (`tokenStorage`) and exposes `apiFetch`, a `fetch` wrapper
that attaches `Authorization: Bearer <access>` and transparently retries once after a silent refresh on 401.
Almost every other `src/api/*.js` module imports `apiFetch` (or `tokenStorage` directly, for raw `fetch`/file
downloads) from `./auth` rather than duplicating auth logic. `AuthContext` (`src/contexts/AuthContext.jsx`)
wraps this with `user`/`loading`/`login`/`login2fa`/`logout`/`activeSession`, and `App.jsx` shows `AuthPage`
(login/register/activate/2FA/reset — all inline screens, no routing) whenever `user` is null.

Login supports a 2FA step (`login2fa`) and an "account pending department confirmation" state
(`user.is_confirmed === false`), which gates most pages but still lets the user sit on `configurator`/`product`.

### Permissions

Backend-issued permission codes (dot-namespaced strings like `catalog.binding.write`, `bom.spec.write`,
`plm.stage.manage`) live on `user.permissions`. Check them with `can(user, code)` / `canAny(user, codes)`
from `src/utils/permissions.js` — never hardcode role checks. Permission codes are namespaced per backend
Django app (`catalog.*`, `bom.*`, `plm.*`, `sales.*`, `external.*`, `portal.*`, `passport.*`, `pdf.*`).

### API layer (`src/api/*.js`)

One module per backend app, each with its own `BASE` constant (e.g. `/api/v1/catalog`, `/api/v1/bom`,
`/api/v1/plm`, `/api/v1/sales`, `/api/v1/media`, `/api/v1/selection`) and an exported object of methods
that call `apiFetch`/`fetch` and return `{ ok, status, data }`. Follow this shape for new endpoints rather
than calling `fetch` directly from components. `src/utils/index.js#parseError(data, status)` turns an API
error response into a Russian user-facing message; use it in catch blocks instead of ad hoc error strings.

### The configurator (`src/components/configurator/FilterTree.jsx`)

This is the largest and most central component (~1300 lines) — a Cytoscape.js-driven graph UI for
filtering/selecting products by "axes" (parameter dimensions) and tags, with two modes:
- **filter mode**: end users narrow down a product graph to a selection, feeding `SpecEditorPage`/`SpecPreviewPage`/issue threads.
- **binding mode** (`catalog.binding.write`): admins edit which products bind to which axis-value combinations,
  via `BindingGraph.jsx` and `ProductBindingPanel.jsx`.

State (selected axes/nodes, filter results, intersection ids) is lifted to `App.jsx`'s `configuratorState`
and persisted to `sessionStorage` so navigating away and back restores the graph. `useChainSearch` (in
`src/hooks/`) backs the product search/autocomplete used inside it.

### Real-time issues/chat

`src/hooks/useIssuesSocket.js` owns a single WebSocket connection (via `useReducer`) to `/ws`, handling
thread history merge/dedup against previews, live message events, etc. `IssuesContext` wraps it for the
`IssuesPage`/`IssueThreadPage`/`CreateThreadModal` components. Threads can be opened contextually from other
pages (e.g. from a product or the configurator) via `onOpenThread` callbacks threaded through `App.jsx`.

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
