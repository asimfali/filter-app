import { useState } from 'react';
import { useIssues } from '../../contexts/IssuesContext.jsx';

export default function CreateIssueModal({ thread, onClose }) {
  const { createIssue } = useIssues();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !departmentId) return;

    setLoading(true);
    setError(null);
    try {
      await createIssue(thread.id, {
        title: title.trim(),
        description: description.trim(),
        assigned_to_department: departmentId,
      });
      onClose();
    } catch (err) {
      setError(err?.error ?? 'Ошибка при создании замечания');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center
                 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl
                      w-full max-w-md mx-4 overflow-hidden">

        {/* Шапка */}
        <div className="flex items-center justify-between px-6 py-4
                        border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Новое замечание
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                       transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="px-6 py-4 flex flex-col gap-4">

          {/* Заголовок */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Заголовок <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Кратко опишите замечание"
              autoFocus
              className="w-full px-3 py-2 text-sm rounded-lg
                         bg-gray-50 dark:bg-gray-800
                         border border-gray-200 dark:border-gray-700
                         text-gray-900 dark:text-gray-100
                         placeholder-gray-300 dark:placeholder-gray-600
                         focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Описание */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Подробности..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg resize-none
                         bg-gray-50 dark:bg-gray-800
                         border border-gray-200 dark:border-gray-700
                         text-gray-900 dark:text-gray-100
                         placeholder-gray-300 dark:placeholder-gray-600
                         focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Исполнитель */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Исполнитель (подразделение) <span className="text-red-500">*</span>
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg
                         bg-gray-50 dark:bg-gray-800
                         border border-gray-200 dark:border-gray-700
                         text-gray-900 dark:text-gray-100
                         focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="" disabled>Выберите подразделение</option>
              {thread.allowed_departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Ошибка */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Кнопки */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg
                         border border-gray-200 dark:border-gray-700
                         text-gray-600 dark:text-gray-400
                         hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !departmentId || loading}
              className="flex-1 px-4 py-2 text-sm rounded-lg font-medium
                         bg-blue-600 hover:bg-blue-700 text-white
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
            >
              {loading ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}