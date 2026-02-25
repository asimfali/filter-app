#!/bin/bash

# Файлы для обработки
FILES="src/App.jsx src/components/layout/Header.jsx src/components/auth/LoginForm.jsx src/components/auth/RegisterForm.jsx src/components/auth/ActivateForm.jsx src/components/auth/TwoFAForm.jsx src/pages/ParameterEditorPage.jsx src/pages/StaffPage.jsx src/components/FilterTree.jsx"

for FILE in $FILES; do
  echo "Processing $FILE..."

  # Фоны
  sed -i 's/bg-white/bg-white dark:bg-gray-900/g' "$FILE"
  sed -i 's/bg-gray-50/bg-gray-50 dark:bg-gray-950/g' "$FILE"
  sed -i 's/bg-gray-100/bg-gray-100 dark:bg-gray-800/g' "$FILE"
  sed -i 's/bg-gray-200/bg-gray-200 dark:bg-gray-700/g' "$FILE"

  # Границы
  sed -i 's/border-gray-200/border-gray-200 dark:border-gray-700/g' "$FILE"
  sed -i 's/border-gray-300/border-gray-300 dark:border-gray-600/g' "$FILE"
  sed -i 's/border-gray-100/border-gray-100 dark:border-gray-800/g' "$FILE"

  # Текст
  sed -i 's/text-gray-900/text-gray-900 dark:text-white/g' "$FILE"
  sed -i 's/text-gray-800/text-gray-800 dark:text-gray-200/g' "$FILE"
  sed -i 's/text-gray-700/text-gray-700 dark:text-gray-300/g' "$FILE"
  sed -i 's/text-gray-600/text-gray-600 dark:text-gray-400/g' "$FILE"
  sed -i 's/text-gray-500/text-gray-500 dark:text-gray-400/g' "$FILE"
  sed -i 's/text-gray-400/text-gray-400 dark:text-gray-500/g' "$FILE"

  # Hover фоны
  sed -i 's/hover:bg-gray-50/hover:bg-gray-50 dark:hover:bg-gray-800/g' "$FILE"
  sed -i 's/hover:bg-gray-100/hover:bg-gray-100 dark:hover:bg-gray-700/g' "$FILE"

  # Инпуты и селекты — добавить dark фон
  sed -i 's/focus:ring-blue-500"/focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600"/g' "$FILE"

  echo "Done $FILE"
done

echo "All files processed!"