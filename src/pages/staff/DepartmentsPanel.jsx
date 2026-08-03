import { useState } from 'react';
import { apiFetch } from '../../api/auth';
import Modal from '../../components/common/Modal';
import { parseError } from '../../utils';
import { inputCls } from '../../utils/styles';
import { API, useRoles } from '../../hooks/useStaff';
import DepartmentTree from './DepartmentTree';
import DeptPermissionsTab from './DeptPermissionsTab';
import SpecPermissionsTab from './SpecPermissionsTab';

// ── Панель подразделений (новая версия с иерархией) ───────────────────────

export default function DepartmentsPanel({ departments, reload }) {
    const [modal, setModal] = useState(null);
    const [activeTab, setActiveTab] = useState('main'); // 'main' | 'permissions'
    const [form, setForm] = useState({ name: '', code: '', description: '', parent: null });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const roles = useRoles(); // уже есть в компоненте выше — пробросить или использовать хук

    const openAdd = (parentDept = null) => {
        setForm({ name: '', code: '', description: '', parent: parentDept?.id || null });
        setModal({ _parent: parentDept });
        setActiveTab('main');
        setError('');
    };

    const openEdit = (dept) => {
        setForm({ name: dept.name, code: dept.code, description: dept.description || '', parent: dept.parent || null });
        setModal(dept);
        setActiveTab('main');
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const isEdit = modal?.id;
        const url = isEdit ? `${API}/departments/${modal.id}/` : `${API}/departments/`;
        const method = isEdit ? 'PATCH' : 'POST';
        try {
            const res = await apiFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (res.ok) { reload(); setModal(null); }
            else setError(parseError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    const modalTitle = modal?.id
        ? `Редактировать: ${modal.name}`
        : modal?._parent
            ? `Новое подразделение в «${modal._parent.name}»`
            : 'Новое корневое подразделение';

    const isEdit = modal?.id;

    return (
        <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Структура подразделений
                </span>
                <button onClick={() => openAdd(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs
                               px-2.5 py-1.5 rounded-lg transition-colors">
                    + Добавить корневое
                </button>
            </div>

            {departments.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">Нет подразделений</p>
            ) : (
                <DepartmentTree departments={departments} onEdit={openEdit} onAdd={openAdd} />
            )}

            {modal !== null && (
                <Modal title={modalTitle} onClose={() => setModal(null)} wide={isEdit}>
                    {/* Вкладки — только для редактирования существующего */}
                    {isEdit && (
                        <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg mb-4">
                            {[
                                { id: 'main', label: 'Основное' },
                                { id: 'permissions', label: 'Права' },
                                { id: 'specs', label: 'Характеристики' },
                            ].map(t => (
                                <button key={t.id} onClick={() => setActiveTab(t.id)}
                                    className={`flex-1 py-1.5 rounded text-sm transition-colors ${activeTab === t.id
                                            ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                                        }`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Вкладка Основное */}
                    {activeTab === 'main' && (
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {form.parent && modal?._parent && (
                                <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                                    Родитель: <strong>{modal._parent.name}</strong>
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Название
                                </label>
                                <input required value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="Бюро автоматики" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Код <span className="text-gray-400 font-normal">(латиница)</span>
                                </label>
                                <input required value={form.code}
                                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                    placeholder="ba" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    Описание
                                </label>
                                <input value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Необязательно" className={inputCls} />
                            </div>
                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-xs
                                                px-3 py-2 rounded-lg">{error}</div>
                            )}
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setModal(null)}
                                    className="flex-1 border border-gray-300 dark:border-gray-600
                                               text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg
                                               hover:bg-neutral-50 dark:hover:bg-neutral-800">
                                    Отмена
                                </button>
                                <button type="submit" disabled={loading}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                                               text-white text-sm py-2 rounded-lg">
                                    {loading ? 'Сохранение...' : 'Сохранить'}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Вкладка Права — только для существующего подразделения */}
                    {activeTab === 'permissions' && isEdit && (
                        <DeptPermissionsTab deptId={modal.id} roles={roles} />
                    )}
                    {activeTab === 'specs' && isEdit && (
                        <SpecPermissionsTab deptId={modal.id} />
                    )}
                </Modal>
            )}
        </div>
    );
}
