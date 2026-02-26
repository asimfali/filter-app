import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationsContext.jsx';

const API_BASE = '/api/v1/catalog';

const NOTIFICATION_LABEL = {
  new_issue:      'Новое замечание',
  new_message:    'Новое сообщение',
  status_changed: 'Статус изменён',
  assigned:       'Назначен исполнитель',
};

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Колокольчик ─────────────────────────────────────────────────────────────

function NotificationBell({ onNavigate }) {
  const { notifications, unreadCount, markAllRead, dismiss } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Закрытие по клику вне
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  const handleClick = (n) => {
    dismiss(n.id);
    setOpen(false);
    if (n.thread_id) onNavigate('issue-thread', n.thread_id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Кнопка */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg
                   text-gray-500 dark:text-gray-400
                   hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        title="Уведомления"
      >
        🔔
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white
                           text-[10px] font-bold rounded-full flex items-center justify-center
                           leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Дропдаун */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 z-50
                        bg-white dark:bg-gray-900
                        border border-gray-200 dark:border-gray-700
                        rounded-xl shadow-xl overflow-hidden">

          {/* Шапка */}
          <div className="flex items-center justify-between px-4 py-3
                          border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Уведомления
            </span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
              >
                Прочитать все
              </button>
            )}
          </div>

          {/* Список */}
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
                Нет уведомлений
              </li>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors
                      hover:bg-gray-50 dark:hover:bg-gray-800
                      ${!n.is_delivered ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Индикатор непрочитанного */}
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0
                        ${!n.is_delivered ? 'bg-blue-500' : 'bg-transparent'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {NOTIFICATION_LABEL[n.notification_type] ?? n.notification_type}
                        </p>
                        {n.text && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {n.payload.text}
                          </p>
                        )}
                        <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">
                          {new Date(n.created_at).toLocaleString('ru-RU', {
                            day: 'numeric', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function Header({ currentPage, onNavigate }) {
  const { user, logout, activeSession } = useAuth();
  const { dark, toggle } = useTheme();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setSearching(true);
    fetch(`${API_BASE}/products/search/?q=${encodeURIComponent(debouncedQuery)}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) { setResults(data.data); setOpen(true); }
      })
      .catch(() => {})
      .finally(() => setSearching(false));
  }, [debouncedQuery]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (product) => {
    setQuery(''); setResults([]); setOpen(false);
    onNavigate('product', product.id);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); inputRef.current?.blur(); }
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700
                       px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6 shrink-0">
        <span className="font-bold text-gray-900 dark:text-white text-sm">
          Корпоративный портал
        </span>
        {user && (
          <nav className="flex gap-1">
            {(() => {
              const ALL_PAGES = [
                { id: 'configurator', label: 'Конфигуратор' },
                { id: 'parameters',   label: 'Параметры' },
                { id: 'staff',        label: 'Персонал' },
                { id: 'documents',    label: 'Документы' },
                { id: 'issues',       label: 'Замечания' },
              ];
              const visiblePages = user?.pages
                ? ALL_PAGES.filter(p => user.pages.includes(p.id))
                : ALL_PAGES;
              const navItems = [
                ...visiblePages,
                ...(activeSession?.data?.page === 'spec-editor'
                  ? [{ id: 'spec-editor', label: '✎ Редактор' }]
                  : []),
              ];
              return navItems.map(item => (
                <button key={item.id} onClick={() => onNavigate(item.id)}
                  className={`px-3 py-1.5 rounded text-sm transition-colors
                    ${currentPage === item.id
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}>
                  {item.label}
                </button>
              ));
            })()}
          </nav>
        )}
      </div>

      {/* Поиск */}
      {user && (
        <div className="relative flex-1 max-w-sm">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setOpen(true)}
              placeholder="Поиск товара..."
              className="w-full pl-8 pr-4 py-1.5 text-sm rounded-lg
                         bg-gray-100 dark:bg-gray-800
                         border border-transparent focus:border-blue-500
                         text-gray-900 dark:text-white
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:outline-none transition-colors"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                ···
              </span>
            )}
          </div>
          {open && (
            <div ref={dropdownRef}
              className="absolute top-full left-0 right-0 mt-1 z-50
                         bg-white dark:bg-gray-900
                         border border-gray-200 dark:border-gray-700
                         rounded-lg shadow-lg overflow-hidden">
              {results.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">
                  Ничего не найдено
                </div>
              ) : (
                <ul>
                  {results.map(product => (
                    <li key={product.id}>
                      <button onClick={() => handleSelect(product)}
                        className="w-full text-left px-4 py-2.5 text-sm
                                   hover:bg-gray-50 dark:hover:bg-gray-800
                                   transition-colors border-b border-gray-100
                                   dark:border-gray-800 last:border-0">
                        <div className="text-gray-900 dark:text-white font-medium">
                          {product.name}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {product.product_type}
                          {product.sku && <> · {product.sku}</>}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 shrink-0">
        {/* Колокольчик */}
        {user && <NotificationBell onNavigate={onNavigate} />}

        <button onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg
                     text-gray-500 dark:text-gray-400
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title={dark ? 'Светлая тема' : 'Тёмная тема'}>
          {dark ? '☀️' : '🌙'}
        </button>

        {user && (
          <>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {user.full_name || user.username}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
            </div>
            <button onClick={logout}
              className="text-xs text-gray-500 dark:text-gray-400
                         hover:text-red-600 dark:hover:text-red-400
                         border border-gray-200 dark:border-gray-700
                         hover:border-red-300 dark:hover:border-red-600
                         px-3 py-1.5 rounded transition-colors">
              Выйти
            </button>
          </>
        )}
      </div>
    </header>
  );
}