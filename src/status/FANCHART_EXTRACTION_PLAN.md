# FANCHART_EXTRACTION_PLAN.md — вынос «Графиков» (fan-charts) в отдельный frontend

_Создан: август 2026_

## Статус реализации (обновлено: август 2026)

Шаги 1–3 и 6 из «Порядка выполнения» сделаны: новый проект `~/develop/filter-app-graphs`
(отдельный git-репозиторий, не входит в этот) — файлы скопированы вербатим, `api`/`permissions`
урезаны, добавлен bootstrap-`App.jsx` без своего логина. `npm run build`/`npm run lint`/
`npx vitest run` — зелёные, lint-фон 1:1 совпадает с этим репозиторием (ничего нового не внесено).

Nginx-блок `location ^~ /graphs/` добавлен на сервере (сделано пользователем). Git-remote
`local` для `filter-app-graphs` (bare-репо `ssh://wms@10.10.0.165/home/wms/git-repos/tmdata/filter-app-graphs.git`)
заведён и подключён, ветки `master`/`dev`/`prod` запушены. `prod.sh`/`deploy_frontend.sh`
(деплоит в `/opt/tmdata/frontend-graphs/dist`) скопированы в `filter-app-graphs` по образцу
`filter-app`.

GitHub-remote `origin` — `git@github.com:asimfali/filter-app-graphs.git`, подключён и запушен
(`master`/`dev`/`prod`).

Локальное тестирование (без nginx) подтверждено рабочим: `filter-app-graphs` крутится своим
dev-сервером на :5174 (`base: '/graphs/'`, значит открывать `http://<host>:5174/graphs/`,
не `/`), backend на :8000 общий. Порталы на разных портах = разные origin, поэтому JWT
между `localStorage :5173` и `:5174` не расшаривается сам — переносится вручную через
DevTools на время локальной разработки; в проде под одним nginx-origin это не нужно.

По ходу нашли и починили баг: `App.jsx` изначально на отсутствие/невалидность токена делал
`window.location.href = '/'` — на dev-сервере `/graphs/` это зацикливалось (`/` редиректит
обратно на `/graphs/` из-за `base`, там снова нет токена → снова редирект, до бесконечности,
+ уронило заодно чужой `filter-app` dev-сервер общим `pkill -f vite` при отладке — сорри).
Заменено на статичный экран со ссылкой (клик, не авто-навигация) — того же класса зацикливание
теоретически возможно и в проде (истёкшая сессия ровно в момент захода), так что фикс общий,
не только dev-костыль.

Первый реальный деплой сделан (2026-08-07): `prod.sh` → сервер `tmdata@10.10.0.177`,
чекаут `~/develop/frontend/filter-app-graphs`, `./deploy_frontend.sh` → `/opt/tmdata/frontend-graphs/dist`.
По пути поймали и исправили баг в `package.json` (не перенёс пин
`@tailwindcss/oxide-linux-x64-gnu` — без него `npm run build` падает на сервере с
`Cannot find native binding`, известный баг npm/cli#4828).

Осталось:
- решить, убирать ли пункт `fan-charts` из `Header.jsx`/`App.jsx` этого репозитория,
  см. «Открытые вопросы» ниже.

## Зачем

Нужно дать внешнему подрядчику доступ только к странице «Графики» (аэродинамические
характеристики, `fan-charts`), без доступа к остальному порталу — возможно, через Electron.
Вход и права должны оставаться теми же, что выдаёт основной портал (JWT + RBAC-коды бэкенда),
без отдельного логина/SSO-протокола.

**Scope (согласовано):** только просмотр/редактирование уже созданных графиков
(текущий функционал `FanChartPage`). Импорт из DXF-чертежей **не входит** в вынос — он
сейчас реализован внутри `SyncModal.jsx` (инструмент синхронизации с внешним сайтом) и
остаётся в основном портале.

## Что переносится

```
src/pages/fanchart/
  FanChartPage.jsx
  FanChartEditorPanel.jsx
  CombinedTab.jsx
  useFanChartData.js
  useCombinedFanChart.js
  constants.js

src/components/fanchart/
  FanChartLegend.jsx
  AxisSettingsPanel.jsx
  NetworkCurvePanel.jsx
  AddCurveModal.jsx

src/components/common/FanChartEditor.jsx   ← у него один потребитель (эти же страницы),
                                              переносится целиком, не остаётся в common/
```

Соответствующие тесты (`src/pages/fanchart/__tests__/`, `src/components/fanchart/__tests__/`
если есть, `src/components/common/__tests__/FanChartEditor.test.jsx`) переезжают вместе с кодом.

### API-поверхность (backend не меняется)

Из `src/api/selection.js` в новый app переезжают/копируются только методы `fan-charts*`:

```
fanCharts, fanChartDetail, fanChartCreate, fanChartSave,
fanChartOperatingPoint, fanChartCombined, fanChartSelect
```

(`fanChartDelete`, `fanChartInterpolated` — по grep нигде не вызываются, не переносить,
пока не понадобятся). Остальные методы `selectionApi` (`proposals*`, `calculate`, `config`,
`dxfImport*`) — это отдельный REST-подресурс `/api/v1/selection/*`, никак не задет, backend
трогать не нужно вообще.

### Что нужно из общего кода — минимальный набор

Осознанно **не** тащим в новый app `AuthContext`/`AuthPage` целиком (логин с 2FA/регистрацией/
восстановлением — это ~несколько сотен строк, которые новому app не нужны). Вместо этого:

- Новый app — **только для уже залогиненных**. При старте проверяет `tokenStorage` (тот же
  ключ `localStorage`, что у портала); если токена нет/refresh не удался — редирект на `/`
  (корень основного портала, где `App.jsx` и так показывает `AuthPage`, если `user === null`).
  Это и есть «вход из этого интерфейса» буквально, без дублирования логина.
- Копируются 2 файла: `api/auth.js` (`apiFetch` + `tokenStorage`, без остального) и
  `utils/permissions.js` (`can`/`PERM`, или хотя бы код `PAGE_GRAPH_READ`).
- Гейт видимости: `can(user, PERM.PAGE_GRAPH_READ)` — то же условие, что сейчас в
  `Header.jsx:223`. Бэкенд и так не отдаёт `fan-charts*` без этого права — фронтовая проверка
  дублирует UX, не является границей безопасности.
- `user` в новом app достаётся отдельным вызовом `GET /api/v1/authority/...` (тем же, что
  использует `AuthContext` для восстановления сессии по токену) — не через React-контекст
  портала, а свою мини-обвязку в новом app.

Копии, а не общий npm-пакет/монорепа — это единственный выносимый модуль на сейчас, монорепо
не оправдано. Если появится второй модуль по той же схеме — тогда стоит завести
`@teplomash/portal-core` и мигрировать обе копии на него.

## Nginx

Текущий конфиг (`~/develop/drf_catalog_service/systemd/nginx.conf`) — один `server`, всё на
одном origin, SPA раздаётся из `/opt/tmdata/frontend/dist`, есть **нерегэксп-анкоренная**
регулярка:

```nginx
location ~* /assets/ {
    root /opt/tmdata/frontend/dist;
    ...
}
```

Это `~*` без `^`, то есть она матчит `/assets/` **где угодно в URI**, включая
`/graphs/assets/...`. Если добавить новый `location /graphs/` обычным префиксом, запросы
к ассетам нового приложения перехватит именно это правило и отдаст 404 (ищет их в
`frontend/dist`, а не `frontend-graphs/dist`). Решение — новый location с `^~`, который
в порядке приоритета nginx (точное совпадение → `^~`-префикс → regex по порядку →
обычный префикс) обрывает дальнейший перебор раньше regex-правил, существующий блок трогать
не нужно:

```nginx
location ^~ /graphs/ {
    alias /opt/tmdata/frontend-graphs/dist/;
    try_files $uri $uri/ /graphs/index.html;
    add_header Cache-Control "no-cache";
}
```

Держим на том же `server`/origin (не поддомен) — это то, что даёт бесплатный шаринг
`localStorage`-токена между порталом и `/graphs/` без ручного handoff.

## Новый Vite-проект

- `vite.config.js`: добавить `base: '/graphs/'` (иначе собранные абсолютные пути к ассетам
  вида `/assets/...` не найдутся под `/graphs/`). Роутинга внутри (react-router) не нужно —
  страница и так без под-путей, как сейчас.
- `vite-plugin-legacy` (Chrome 49 и т.д.) — решить отдельно: если это только для Electron
  (свежий Chromium) можно не тащить, экономит время сборки; если `/graphs/` также будет
  открываться обычными пользователями портала в браузере — оставить как в основном
  `vite.config.js`, для консистентности.
- Сборка/деплой зеркалит текущий `deploy_frontend.sh`, но в `/opt/tmdata/frontend-graphs/dist`.

## Electron (если нужен desktop-обёртка)

Рекомендация — тонкая обёртка: `BrowserWindow` грузит `https://<host>/graphs/` как обычную
страницу (тот же origin, значит тот же `localStorage` браузерного профиля Electron —
если пользователь логинился в Chromium-профиле Electron ранее, токен уже там). Никакого
отдельного протокола/deep-link не требуется. Полноценный offline-бандл в Electron с обменом
одноразовым кодом — усложнение, которое сейчас не нужно при данном scope.

## Порядок выполнения

1. Скопировать перечисленные файлы в новый репозиторий, поправить относительные импорты.
2. Скопировать `api/auth.js`/`utils/permissions.js` (минимальный срез), написать
   bootstrap-проверку токена + редирект на `/` при её отсутствии.
3. Поднять новый Vite-проект (`base: '/graphs/'`), локально проверить сборку.
4. Nginx: добавить блок `location ^~ /graphs/` (правите сами/через backend Claude) —
   см. готовый сниппет выше.
5. В основном портале — опционально: убрать пункт `fan-charts` из `Header.jsx`/`App.jsx`,
   если «Графики» полностью переезжают и больше не нужны как страница портала (или оставить
   оба входа, если внутренние пользователи тоже должны продолжать пользоваться веткой в
   портале — решить отдельно, не блокирует вынос).
6. Прогнать перенесённые тесты в новом репозитории (`npx vitest run`), `npm run lint`,
   `npm run build`.

## Открытые вопросы (на потом, не блокируют вынос)

- Остаётся ли `fan-charts` также страницей внутри основного портала для штатных
  сотрудников, или для них тоже будет ссылка на `/graphs/`? Влияет на то, удалять ли код
  из `filter-app` или оставить дубль на переходный период.
- Если появится второй модуль на вынос по этой же схеме — заводить общий пакет
  (`@teplomash/portal-core`) для `auth.js`/`permissions.js`, а не копии.
