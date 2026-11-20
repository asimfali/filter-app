# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

Project-specific workflow rules (DRY discipline, diff-only edits, no multiple-choice questions) live in the rontend-workflow skill — read it, it is not repeated here.

## What this is

Тепломаш ("Teplomash") corporate portal frontend — a React SPA for an internal system covering:
product configuration/filtering (a graph-based selector), BOM/spec editing, PLM stage tracking,
media/document management, sales carts, issue tracking with live chat, and staff/permissions admin.
The UI is entirely in Russian. It's a Vite + React 18 app talking to a separate backend (not in this repo)
over `/api/v1/*` REST endpoints and a `/ws` WebSocket.


## Команды

```bash
npm run dev      # :5173, проксирует /api и /media на :8000, /ws на :8001
npm run build
npm run lint
npm test         # весь сьют vitest; конвенции — скилл frontend-tests
```

## Инварианты

- **Библиотеки роутера нет.** `src/App.jsx` держит `page` в состоянии и вручную обрабатывает `window.history.pushState`/`popstate` через `handleNavigate(page, payload)`. Новая страница = ветка в `MainApp` + вызов `handleNavigate`, а для выживания после refresh — сохранение payload в `sessionStorage` (как `selectedProductId`, `selectedThreadId`, `specPreviewProductIds`).
- **Деплой только по прямой просьбе.** `./prod.sh` мержит текущую ветку в `prod` и пушит в оба remote; `deploy_frontend.sh` выполняется **на сервере** и выкатывает `dist/` в прод. Без явной просьбы их не запускать.
- **Legacy-браузеры.** `vite-plugin-legacy` целится в Chrome 49 / Firefox 52 / Edge 18 — не полагаться на свежий JS/CSS без проверки, что полифилы это покрывают.
- **UI полностью на русском**, тексты не выдумывать.

## Где детали

- `frontend-architecture` — роутинг, Auth, права, слой `src/api`, конфигуратор, websocket-чат.
- `frontend-structure` — сессии и `sessionStorage`, стили Tailwind, карта `src/`, legacy-сборка.
- `frontend-workflow` — DRY, обязательные проверки перед коммитом, стандарты кода, запреты.
- `frontend-dev-env` — команды, точечный vitest, ручной деплой, справочные репозитории.
- `frontend-tests` — конвенции тестов; `status-memory` — планы в `status/` (читать скриптом).

## Память проекта

Важные решения и договорённости фиксируй в `docs/DECISIONS.md` — дописывать в конец, существующие записи не менять (файл общий для нескольких агентов, append-only). Не дублируй туда то, что уже есть в этом файле; секреты не записывать.

---


## Границы

`AGENTS.md` — единственный файл инструкций: реальный `CLAUDE.md` не создавать, личные настройки инструментов — в `.gitignore`. Трогать только то, что нужно задаче.

**Бюджет: `AGENTS.md` ≤ 2000 токенов** — мерить `python scripts/ctx_cost.py AGENTS.md`; всё, что не влезает, живёт в скиллах.