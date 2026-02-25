import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200
                       dark:border-gray-700 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-gray-900 dark:text-white text-sm">
          Корпоративный портал
        </span>
        {user && (
          <nav className="flex gap-1">
            {[
              { id: 'configurator', label: 'Конфигуратор' },
              { id: 'parameters',   label: 'Параметры' },
              { id: 'staff',        label: 'Персонал' },
            ].map(item => (
              <button key={item.id} onClick={() => onNavigate(item.id)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}>
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Переключатель темы */}
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