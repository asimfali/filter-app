# Задание: dev-сервер фронтенда в IDE + связка с локальным бэкендом

Дата постановки: 13.11.2026. Составлено по итогам настройки backend-проекта.

## Цель

Поднять dev-сервер фронтенда кнопкой Play в PyCharm и убедиться, что он ходит
в **локальный** бэкенд (`tmdata-tmdata/backend`), а не в прод: HTTP API, авторизация
по JWT и websocket-чат.

## Контекст: что уже работает

**Бэкенд уже поднят локально** (проект `teplomash-tmdata/backend`, в IDE запускается
конфигурацией «tmdata full stack» — runserver + daphne + celery worker + celery beat):

| Сервис | Адрес | Что отдаёт |
|---|---|---|
| Django runserver | `http://127.0.0.1:8000` | HTTP API `/api/v1/...`, админка `/admin/`, медиа `/media/...` |
| Daphne (ASGI) | `ws://127.0.0.1:8001` | websocket-чат `/ws/issues/` |
| Celery worker + beat | брокер Redis `127.0.0.1:6379/1` | фоновые задачи (синк, бэкапы, реестр) |

БД — локальный PostgreSQL, база `tmdata_20261018`; настройки берутся из `.env.dev`,
который сам читает `manage.py` (переменные окружения вручную задавать не нужно).

## Контекст: что уже известно про фронтенд

- React + Vite + Tailwind v4, тесты на vitest.
- `package.json`: `dev` = `vite`, `build`, `lint`, `preview`, `test`, `test:watch`.
- `vite.config.js` **уже содержит прокси на локальный бэк**:
  - `/api` → `http://localhost:8000`
  - `/ws` → `ws://localhost:8001` (с `ws: true`)
  - `/media` → `http://localhost:8000`
  - dev-сервер на порту **5173**, `host: true`, `allowedHosts: ['lab']`
- Запросы в коде относительные (`/api/v1/...`), поэтому адрес API через env не
  задаётся — всё идёт через прокси Vite. Файлов `.env*` нет.
- `import.meta.env.DEV` используется только для внешних ссылок
  (`src/components/layout/Header.jsx`: GRAPHS_URL, DOCGEN_URL).
- Авторизация — JWT в `localStorage`: `access_token`, `refresh_token`;
  обновление через `/api/v1/auth/token/refresh/` (`src/api/auth.js`).
- Websocket чата: `src/hooks/useIssuesSocket.js` открывает
  `ws://${window.location.host}/ws/issues/?token=...` — то есть тоже через прокси на 5173.
- Node на машине: `C:\nvm4w\nodejs\node.exe` (v24.21.0), `node_modules` установлен.
- В `.idea` **нет run-конфигураций**, а `modules.xml` ссылается на несуществующий
  `.idea/tmdata/frontend.iml`.

## Шаги

1. Прочитать `AGENTS.md` проекта и следовать его правилам.
2. Проверить, что в PyCharm задан Node-интерпретатор
   (`Settings → Languages & Frameworks → Node.js`) — `C:\nvm4w\nodejs\node.exe`,
   пакетный менеджер npm. Если модуль проекта не подхватывается (нет `.iml`) —
   привести в порядок либо объяснить, почему это ни на что не влияет.
3. Создать run-конфигурацию dev-сервера, чтобы он запускался кнопкой Play:
   - тип **npm**, команда `run`, скрипт `dev`;
   - `package.json` и working directory — корень проекта, Node interpreter = проект;
   - сохранить как проект-файл в `.idea/runConfigurations/` (в backend так же
     сохранены runserver/celery/daphne), чтобы конфигурация была воспроизводимой.
4. Поднять сервер, убедиться, что `http://localhost:5173` открывается.
5. Проверить связь с локальным бэком и показать доказательства:
   - **HTTP через прокси**: GET к `/api/v1/...` (например `/api/v1/catalog/products/?limit=1`)
     — код ответа и что данные пришли с локального бэка;
   - **логин** своим пользователем в UI → в `localStorage` появились
     `access_token`/`refresh_token`, дальнейшие запросы идут с `Authorization: Bearer`;
   - **refresh** токена не падает;
   - **websocket**: открыть раздел замечаний/чата, в DevTools → Network → WS
     соединение `/ws/issues/` поднялось (101 Switching Protocols).
6. Если прокси не достучался до бэка — сначала проверить, что бэк запущен
   (`http://127.0.0.1:8000/admin/`, порт 8001), затем учесть известную ловушку
   Windows: Node может резолвить `localhost` в `::1`, а Django/Daphne слушают
   `127.0.0.1` → в консоли Vite будет `ECONNREFUSED`. Лечение — заменить `localhost`
   на `127.0.0.1` в `target`'ах блока `server.proxy` в `vite.config.js`
   (это только dev-блок, на прод-сборку не влияет) и попросить перезапустить Vite.
7. Про CORS: бэк разрешает только `http://localhost:5173` (`CORS_ALLOWED_ORIGINS`),
   поэтому приложение надо открывать именно по `localhost:5173`, а не
   `127.0.0.1:5173`. Через прокси CORS не участвует вовсе.

## Ограничения

- Не менять `vite.config.js` вне dev-блока `server`; не трогать деплой-скрипты
  (`deploy_frontend.sh`, `prod.sh`).
- Ничего не коммитить без подтверждения.
- Не запускать `npm run build` и деплой.
- Для проверки нужен запущенный бэк — если он не поднят, попросить пользователя
  запустить «tmdata full stack» (это отдельный проект IDE `teplomash-tmdata/backend`).

## Критерии приёмки / что в отчёте

- Какие файлы созданы/изменены.
- Как запускается dev-сервер: имя конфигурации, кнопка Play.
- Доказательства связи: URL запросов, коды ответов, факт логина, WS-соединение.
- Что не заработало и почему — с точной ошибкой из консоли.

## Быстрый прогон (чек-лист)

- [ ] **1. Бэк поднят.** Открывается `http://127.0.0.1:8000/admin/` и слушается порт 8001
      (`Test-NetConnection 127.0.0.1 -Port 8001`). Если нет — попросить пользователя
      запустить «tmdata full stack» в проекте `backend`.
- [ ] **2. Node-интерпретатор задан** в `Settings → Languages & Frameworks → Node.js`:
      `C:\nvm4w\nodejs\node.exe`, пакетный менеджер npm.
- [ ] **3. Dev-сервер поднимается кнопкой Play** (конфигурация npm `dev`), `http://localhost:5173`
      открывается, в консоли Vite нет ошибок.
- [ ] **4. HTTP-связь через прокси**: запрос `/api/v1/...` из приложения возвращает данные
      локального бэка (200 или 401 без токена), а **не** `ECONNREFUSED`; после логина
      в `localStorage` есть `access_token` и `refresh_token`, запросы идут с `Bearer`.
- [ ] **5. Websocket**: DevTools → Network → WS → `/ws/issues/` со статусом `101`.
      Если 101 нет — смотреть пункт про `localhost`/`::1` выше.

