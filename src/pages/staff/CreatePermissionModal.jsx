import { useState } from 'react';
import { apiFetch } from '../../api/auth';
import Modal from '../../components/common/Modal';
import { parseError } from '../../utils';
import { inputCls } from '../../utils/styles';
import { API } from '../../hooks/useStaff';

// ── Форма создания права ──────────────────────────────────────────────────

const RESOURCE_TYPES = [
    { value: 'product',   label: 'Товар' },
    { value: 'parameter', label: 'Параметр' },
    { value: 'category',  label: 'Категория' },
    { value: 'document',  label: 'Документ' },
    { value: 'user',      label: 'Пользователь' },
    { value: 'spec',      label: 'Характеристика' },
];

const ACTION_TYPES = [
    { value: 'read',         label: 'Чтение' },
    { value: 'write',        label: 'Запись' },
    { value: 'approve',      label: 'Утверждение' },
    { value: 'delete',       label: 'Удаление' },
    { value: 'request_edit', label: 'Запрос на правку' },
    { value: 'grant_edit',   label: 'Выдача разрешения на правку' },
];

export default function CreatePermissionModal({ onClose, onCreated }) {
    const [form, setForm] = useState({
        code: '', name: '', resource_type: '', action: '', description: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Автогенерация кода из resource_type + action
    const suggestCode = (resource_type, action) => {
        if (resource_type && action) {
            return `portal.${resource_type}.${action}`;
        }
        return form.code;
    };

    const handleChange = (field, value) => {
        setForm(prev => {
            const next = { ...prev, [field]: value };
            // Автозаполнение кода если поле не редактировалось вручную
            if (field === 'resource_type' || field === 'action') {
                const auto = suggestCode(
                    field === 'resource_type' ? value : prev.resource_type,
                    field === 'action' ? value : prev.action,
                );
                if (!prev.code || prev.code === suggestCode(prev.resource_type, prev.action)) {
                    next.code = auto;
                }
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await apiFetch(`${API}/permissions/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) {
                onCreated(data);
                onClose();
            } else {
                setError(parseError(data, res.status));
            }
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal title="Новое право доступа" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600
                                          dark:text-gray-400 mb-1">
                            Тип ресурса
                        </label>
                        <select required value={form.resource_type}
                            onChange={e => handleChange('resource_type', e.target.value)}
                            className={inputCls}>
                            <option value="">— выберите —</option>
                            {RESOURCE_TYPES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600
                                          dark:text-gray-400 mb-1">
                            Действие
                        </label>
                        <select required value={form.action}
                            onChange={e => handleChange('action', e.target.value)}
                            className={inputCls}>
                            <option value="">— выберите —</option>
                            {ACTION_TYPES.map(a => (
                                <option key={a.value} value={a.value}>{a.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600
                                      dark:text-gray-400 mb-1">
                        Код
                        <span className="text-gray-400 font-normal ml-1">
                            (автозаполняется)
                        </span>
                    </label>
                    <input required value={form.code}
                        onChange={e => handleChange('code', e.target.value)}
                        placeholder="portal.document.delete"
                        className={inputCls} />
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        Только строчные латинские буквы, цифры и точки
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600
                                      dark:text-gray-400 mb-1">
                        Название
                    </label>
                    <input required value={form.name}
                        onChange={e => handleChange('name', e.target.value)}
                        placeholder="Удаление документов"
                        className={inputCls} />
                </div>

                <div>
                    <label className="block text-xs font-medium text-gray-600
                                      dark:text-gray-400 mb-1">
                        Описание
                        <span className="text-gray-400 font-normal ml-1">(необязательно)</span>
                    </label>
                    <input value={form.description}
                        onChange={e => handleChange('description', e.target.value)}
                        placeholder="Позволяет удалять документы в медиатеке"
                        className={inputCls} />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700
                                    text-xs px-3 py-2 rounded-lg">
                        {error}
                    </div>
                )}

                <div className="flex gap-2 pt-1">
                    <button type="button" onClick={onClose}
                        className="flex-1 border border-gray-300 dark:border-gray-600
                                   text-gray-700 dark:text-gray-300 text-sm py-2
                                   rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800">
                        Отмена
                    </button>
                    <button type="submit" disabled={loading}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                   text-white text-sm py-2 rounded-lg transition-colors">
                        {loading ? 'Создание...' : 'Создать'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
