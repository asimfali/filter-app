# Деплой фронтенда

Сборка — Vite, отдаёт её nginx из `/opt/tmdata/frontend/dist`. Node нужен **только для
сборки**, в рантайме сайта его нет.

## Версия Node

`Node >= 20` (в `.nvmrc` — 24, на нём же собирается прод). Node 18 не подходит:
`@tailwindcss/oxide`, `vitest` и `jsdom` объявляют `engines: >= 20`, и на 18 это
сначала предупреждения `EBADENGINE`, а после любого обновления зависимостей —
падение сборки с `Cannot find module @tailwindcss/oxide`.

На сервере (`tmdata`) системный `/usr/bin/node` — **18 из Ubuntu 24.04**. Его не
трогаем: на нём работает `docgen` (`/opt/tmdata-frontend/docgen`, порт 3000),
это чужое приложение. Node для сборки лежит отдельно:

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
name=$(grep -o 'node-v[0-9.]*-linux-x64\.tar\.xz' SHASUMS256.txt | head -1)
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$name"
grep " $name\$" SHASUMS256.txt | sha256sum -c -
sudo mkdir -p /opt/node24
sudo tar -xJf "$name" -C /opt/node24 --strip-components=1
/opt/node24/bin/node -v
```

Путь переопределяется переменной `NODE_HOME` (по умолчанию `/opt/node24`).

## Сборка

```bash
npm ci            # строго по package-lock.json, lock не меняет
npm run build     # -> dist/
```

`npm install` для сборки не использовать: он переписывает `package-lock.json`
(особенно с `--legacy-peer-deps` — из lock выпадают peer-зависимости, и следующий
`npm ci` падает с `Missing: @testing-library/dom from lock file`).

## `deploy_frontend.sh`

Запускается **из каталога репозитория на сервере** (скрипт не делает `cd`):

```bash
cd ~/develop/frontend/tmdata && ./deploy_frontend.sh
NODE_HOME=/opt/node22 ./deploy_frontend.sh   # другой Node
CLEAN_INSTALL=1 ./deploy_frontend.sh         # переустановить node_modules
```

Что делает: `git pull local prod` → проверка Node (жёстко `>= 20`, иначе выход) →
`npm ci` → `npm run build` → `rsync dist/` в `/opt/tmdata/frontend/` → `systemctl reload nginx`.

`CLEAN_INSTALL=1` удаляет только `node_modules` (не `package-lock.json`) — версии
пакетов остаются теми, что в репозитории.

## Выкат вместе с порталом

`src/api/dealers.js` ходит в `/api/v1/dealers/` (портал без префикса роутера,
`drf_catalog_service@6a12ecf`). Старый двойной путь `/api/v1/dealers/dealers/`
порталом удалён, поэтому фронт и портал выкатываются согласованно: сначала портал,
потом фронт.

Импорт дилеров из xlsx требует работающего celery-воркера портала — иначе задача
импорта навсегда останется в статусе `PENDING`.

## Откат

- сборка: `git checkout <прошлый prod-коммит> && npm ci && npm run build && ./deploy_frontend.sh`
  (или просто вернуть `prod` на предыдущий коммит и перезапустить скрипт);
- Node: `/opt/node24` ставится в отдельный каталог — `sudo rm -rf /opt/node24` возвращает
  всё как было, системный Node при этом не затронут.
