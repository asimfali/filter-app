---
name: frontend-architecture
description: Устройство tmdata-фронтенда — ручной роутинг без react-router, Auth, права/RBAC, слой src/api, конфигуратор FilterTree и websocket-чат. Читать перед правкой App.jsx, src/pages/*, src/api/*, конфигуратора или когда неясно, где живёт поведение.
---
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
