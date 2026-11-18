#!/bin/bash

set -e

PROJECT_DIR="/opt/tmdata"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DEV_DIR="$(pwd)"
GIT_REMOTE="local"
TMDATA_USER="tmdata"

echo "=== FRONTEND DEPLOY: $(date) ==="

# Обновление кода
echo "→ Обновление кода..."
# Если на сервере руками запускали npm install, он мог переписать lock — сбрасываем,
# иначе pull упрётся в конфликт. Штатная сборка ниже (npm ci) lock не меняет.
git checkout -- package-lock.json
git pull "$GIT_REMOTE" prod
echo "  ✓ $(git log -1 --oneline)"

# Сборка идёт на Node из /opt/node24: системный /usr/bin/node (18) остаётся
# для docgen на :3000, а dev-зависимости фронта требуют Node >= 20
# (без этого предупреждения EBADENGINE превращаются в непонятное
# "Cannot find module @tailwindcss/oxide").
NODE_HOME="${NODE_HOME:-/opt/node24}"
if [ ! -x "$NODE_HOME/bin/node" ]; then
    echo "Ошибка: нет $NODE_HOME/bin/node."
    echo "Поставьте Node 22/24 в $NODE_HOME (см. docs/DEPLOY.md) или задайте NODE_HOME=..."
    exit 1
fi
export PATH="$NODE_HOME/bin:$PATH"
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 20 ]; then
    echo "Ошибка: node $(node -v) не подходит, нужен >= 20 (dev-зависимости Vite/Tailwind)."
    echo "Проверьте PATH: $NODE_HOME/bin должен идти перед /usr/bin."
    exit 1
fi
echo "  Node $(node -v), npm $(npm -v)"

# Установка зависимостей и сборка
echo "→ Сборка frontend..."
if [ "${CLEAN_INSTALL:-0}" = "1" ]; then
    echo "  → Чистая установка..."
    rm -rf node_modules
    npm cache clean --force
fi
# npm ci ставит строго по package-lock.json и не переписывает его
npm ci --legacy-peer-deps
npm run build
echo "  ✓ Сборка завершена"

# Синхронизация dist в продакшн
echo "→ Синхронизация в $FRONTEND_DIR..."
sudo mkdir -p "$FRONTEND_DIR"
sudo rsync -a --delete "$DEV_DIR/dist/" "$FRONTEND_DIR/dist/"
sudo chown -R "$TMDATA_USER:$TMDATA_USER" "$FRONTEND_DIR"
echo "  ✓ Готово"

# Перезапуск nginx
sudo systemctl reload nginx

echo "=== FRONTEND DEPLOY DONE: $(date) ==="
