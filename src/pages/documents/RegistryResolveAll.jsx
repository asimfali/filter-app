import { useState } from 'react';
import { mediaApi } from '../../api/media';
import useTaskPolling from '../../hooks/useTaskPolling';

// «Проверить все в реестре» — массовый поиск записей Росаккредитации (portal.documents.registry.edit).
// По завершении onDone — перезагрузка списка: блоки registry и doc_number могли обновиться.
export default function RegistryResolveAll({ onDone }) {
  const [all, setAll] = useState(false);
  const [result, setResult] = useState(null); // {total, checked, found, pushed_to_site, error, items}

  const { busy, info, error, start } = useTaskPolling(mediaApi.registryTaskStatus, (r) => {
    setResult(r || null);
    onDone?.();
  });

  const handleStart = () => {
    setResult(null);
    start(() => mediaApi.resolveAllDocumentsRegistry(all), 'Не удалось запустить проверку');
  };

  const notFound = result?.items?.filter(i => !i.found) || [];
  // При success=false хук уже кладёт result.error в error; найденное до сбоя сохранено и показано ниже
  const shownError = error || result?.error;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-3 space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-gray-700 dark:text-gray-300">Реестр Росаккредитации</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ml-auto">
          <input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} disabled={busy} />
          включая найденные
        </label>
        <button onClick={handleStart} disabled={busy}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white
                     disabled:opacity-50 transition-colors">
          {busy
            ? (info?.total ? `Проверено ${info.current} из ${info.total}` : 'Запуск…')
            : 'Проверить все в реестре'}
        </button>
      </div>

      {shownError && <p className="text-xs text-red-600 dark:text-red-400">{shownError}</p>}

      {result && (
        <div className="text-xs space-y-1.5 border-t border-gray-100 dark:border-gray-800 pt-2">
          <p className="text-gray-700 dark:text-gray-300">
            {result.total === 0
              ? 'Нет документов для проверки'
              : `Найдено ${result.found} из ${result.total}`}
            {result.pushed_to_site && ' · изменения отправлены на сайт'}
          </p>
          {notFound.length > 0 && (
            <div>
              <p className="text-gray-500 dark:text-gray-400 mb-1">Не найдены в реестре:</p>
              <ul className="font-mono text-gray-700 dark:text-gray-300 space-y-0.5">
                {notFound.map(i => <li key={i.id}>{i.doc_number || `документ ${i.id}`}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
