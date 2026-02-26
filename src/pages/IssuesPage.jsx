import { useEffect, useState } from 'react';
import { useIssues } from '../contexts/IssuesContext.jsx';

const STATUS_LABEL = {
  open:        'Открыто',
  in_progress: 'В работе',
  resolved:    'Решено',
  verified:    'Подтверждено',
  rejected:    'Отклонено',
};

const STATUS_COLOR = {
  open:        'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  resolved:    'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  verified:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  rejected:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function ThreadCard({ thread, onOpen }) {
  const openCount = thread.issues_summary?.open ?? 0;
  const totalCount = thread.issues_summary?.total ?? 0;

  return (
    <div
      onClick={() => onOpen(thread.id)}
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                 rounded-xl p-4 cursor-pointer hover:border-blue-400 dark:hover:border-blue-600
                 transition-colors"
    >
      {/* Заголовок + видимость */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-medium text-gray-900 dark:text-gray-100 text-sm leading-snug">
          {thread.title}
        </span>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
          ${thread.visibility === 'PUBLIC'
            ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          }`}>
          {thread.visibility === 'PUBLIC' ? 'Публичный' : 'Ограниченный'}
        </span>
      </div>

      {/* Изделия */}
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        {thread.product_ids?.length ?? 0} изделий
      </p>

      {/* Замечания */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Замечаний: <span className="font-medium text-gray-700 dark:text-gray-300">{totalCount}</span>
          {openCount > 0 && (
            <span className="ml-2 text-orange-600 dark:text-orange-400 font-medium">
              ({openCount} открытых)
            </span>
          )}
        </span>

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium
          ${thread.is_closed
            ? 'bg-gray-100 text-gray-400 dark:bg-gray-800'
            : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
          }`}>
          {thread.is_closed ? 'Закрыт' : 'Активен'}
        </span>
      </div>

      {/* Дата */}
      <p className="text-xs text-gray-300 dark:text-gray-600 mt-2">
        {new Date(thread.created_at).toLocaleDateString('ru-RU', {
          day: 'numeric', month: 'long', year: 'numeric'
        })}
      </p>
    </div>
  );
}

export default function IssuesPage({ onOpenThread }) {
  const { threadList, threadListLoading, fetchThreads, error, connected } = useIssues();
  const [filter, setFilter] = useState('active'); // active | closed | all

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const filtered = threadList.filter((t) => {
    if (filter === 'active') return !t.is_closed;
    if (filter === 'closed') return t.is_closed;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto">

      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Замечания
          </h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            Треды по группам изделий
          </p>
        </div>

        {/* Индикатор WS */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`} />
          {connected ? 'Live' : 'Офлайн'}
        </div>
      </div>

      {/* Фильтр */}
      <div className="flex gap-1 mb-4 bg-gray-100 dark:bg-gray-800/60 rounded-lg p-1 w-fit">
        {[
          { key: 'active', label: 'Активные' },
          { key: 'closed', label: 'Закрытые' },
          { key: 'all',    label: 'Все' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${filter === key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Состояния */}
      {threadListLoading && (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
          Загрузка...
        </div>
      )}

      {error && !threadListLoading && (
        <div className="text-center py-16 text-sm text-red-500">
          Ошибка загрузки. Попробуйте обновить страницу.
        </div>
      )}

      {!threadListLoading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-sm text-gray-400 dark:text-gray-500">
          {filter === 'active' ? 'Нет активных тредов' : 'Ничего не найдено'}
        </div>
      )}

      {/* Список тредов */}
      {!threadListLoading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              onOpen={onOpenThread}
            />
          ))}
        </div>
      )}
    </div>
  );
}