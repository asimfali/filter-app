// src/components/media/FolderUpload.jsx
// Переиспользуемый компонент выбора папки.
// Парсинг пути — снаружи через пропс parseFn.
// Компонент не знает про типы документов и загрузку — только выбор и превью.

import React, { useState } from 'react';

/**
 * @param {Object} props
 * @param {(fileList: FileList) => Array} props.parseFn   — функция парсинга, возвращает [{file, externalId, ...parsed}]
 * @param {(items: Array) => void}        props.onParsed  — колбэк с результатом
 * @param {string}                        [props.accept]  — фильтр файлов, default ".pdf"
 * @param {(item: Object) => React.Node}  [props.renderRow] — кастомный рендер строки превью
 */
export default function FolderUpload({ parseFn, onParsed, accept = '.pdf', renderRow }) {
  const [items, setItems] = useState([]);

  const handleChange = (e) => {
    const parsed = parseFn(e.target.files);
    setItems(parsed);
    onParsed(parsed);
  };

  return (
    <div className="space-y-3">
      {/* Зона выбора */}
      <label className="flex flex-col items-center justify-center border-2 border-dashed
                        rounded-lg p-6 cursor-pointer transition-colors
                        border-gray-300 dark:border-gray-600 hover:border-blue-400">
        <input
          type="file"
          className="hidden"
          // @ts-ignore
          webkitdirectory=""
          multiple
          accept={accept}
          onChange={handleChange}
        />
        <span className="text-2xl mb-2">📁</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Нажмите для выбора папки
        </span>
        {items.length > 0 && (
          <span className="text-xs text-blue-500 mt-1">
            Найдено файлов: {items.length}
          </span>
        )}
      </label>

      {/* Превью */}
      {items.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg
                        overflow-hidden max-h-64 overflow-y-auto">
          <div className="px-3 py-2 bg-neutral-50 dark:bg-neutral-800 text-xs
                          text-gray-500 border-b border-gray-200 dark:border-gray-700
                          sticky top-0">
            {items.length} файлов
          </div>
          {items.map((item, i) =>
            renderRow ? (
              <div key={i} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                {renderRow(item)}
              </div>
            ) : (
              <DefaultRow key={i} item={item} />
            )
          )}
        </div>
      )}
    </div>
  );
}

function DefaultRow({ item }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs
                    border-b border-gray-50 dark:border-gray-800 last:border-0">
      <span className="text-gray-400 w-6 shrink-0">
        {item.heating || '—'}
      </span>
      <span className="text-blue-500 w-28 shrink-0 truncate">
        {item.design || '—'}
      </span>
      <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
        {item.externalId || item.file.name}
      </span>
    </div>
  );
}