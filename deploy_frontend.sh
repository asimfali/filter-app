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
git pull "$GIT_REMOTE" prod
echo "  ✓ $(git log -1 --oneline)"

# Проверка Node.js
if ! command -v node &>/dev/null; then
    echo "→ Установка Node.js..."
    sudo apt-get install -y nodejs npm
fi

# Установка зависимостей и сборка
echo "→ Сборка frontend..."
if [ "${CLEAN_INSTALL:-0}" = "1" ]; then
    echo "  → Чистая установка..."
    rm -rf node_modules package-lock.json
    npm cache clean --force
fi
npm install --legacy-peer-deps
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
