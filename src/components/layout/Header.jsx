import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ currentPage, onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-bold text-gray-900 text-sm">Корпоративный портал</span>
        {user && (
          <nav className="flex gap-1">
            {[
              { id: 'configurator', label: 'Конфигуратор' },
              { id: 'parameters',   label: 'Параметры' },
              { id: 'staff',        label: 'Персонал' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  currentPage === item.id
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {user.full_name || user.username}
            </div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-red-600 border border-gray-200
                       hover:border-red-300 px-3 py-1.5 rounded transition-colors"
          >
            Выйти
          </button>
        </div>
      )}
    </header>
  );
}