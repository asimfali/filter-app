---
name: frontend-dev-env
description: Запуск и деплой tmdata-фронтенда — команды npm, vitest точечно и весь сьют, ручной деплой через prod.sh и deploy_frontend.sh (только по прямой просьбе), справочные репозитории рядом. Читать перед первым запуском или при вопросе про выкатку.
---
## Commands

```bash
npm run dev         # vite dev server on :5173, proxies /api and /media to localhost:8000, /ws to localhost:8001
npm run build       # vite build -> dist/
npm run lint        # eslint .
npm run preview     # preview the production build

# Tests — Vitest + Testing Library (see .agents/skills/frontend-tests/SKILL.md for conventions)
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
  Его собственный `AGENTS.md` документирует backend-инварианты и ссылается на этот
  репозиторий (`~/develop/filter-app`) так же, только-на-чтение, в обратную сторону.
