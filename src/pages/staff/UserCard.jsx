import { useState } from 'react';
import { apiFetch } from '../../api/auth';
import Modal from '../../components/common/Modal';
import { parseError } from '../../utils';
import { inputCls } from '../../utils/styles';
import { API } from '../../hooks/useStaff';

// ── Форма назначения роли ─────────────────────────────────────────────────

function AssignRoleForm({ userId, departments, roles, existingRoles, onSave, onClose }) {
    const [form, setForm] = useState({ department: '', role: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Фильтруем уже назначенные комбинации
    const isAlreadyAssigned = (deptId, roleId) =>
        existingRoles.some(r => String(r.department) === String(deptId) && String(r.role) === String(roleId));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isAlreadyAssigned(form.department, form.role)) {
            setError('Эта комбинация подразделение + роль уже назначена');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const res = await apiFetch(`${API}/user-roles/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: userId, ...form }),
            });
            const data = await res.json();
            if (res.ok) { onSave(data); onClose(); }
            else setError(parseError(data, res.status));
        } catch {
            setError('Ошибка соединения');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Подразделение</label>
                <select required value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className={inputCls}>
                    <option value="">— выберите —</option>
                    {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Роль</label>
                <select required value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    className={inputCls}>
                    <option value="">— выберите —</option>
                    {roles.map(r => (
                        <option key={r.id} value={r.id}>
                            {r.name}{r.can_approve ? ' ✓ может утверждать' : ''}
                        </option>
                    ))}
                </select>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                    {error}
                </div>
            )}

            <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose}
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:bg-neutral-950">
                    Отмена
                </button>
                <button type="submit" disabled={loading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                     text-white text-sm py-2 rounded-lg transition-colors">
                    {loading ? 'Назначение...' : 'Назначить'}
                </button>
            </div>
        </form>
    );
}

// ── Карточка пользователя ─────────────────────────────────────────────────

export default function UserCard({ user, departments, roles, onUpdate }) {
    const [expanded, setExpanded] = useState(false);
    const [modal, setModal] = useState(false);
    const [removing, setRemoving] = useState(null);

    const handleRemoveRole = async (roleId) => {
        if (!confirm('Снять роль?')) return;
        setRemoving(roleId);
        await apiFetch(`${API}/user-roles/${roleId}/`, { method: 'DELETE' });
        setRemoving(null);
        onUpdate();
    };

    const deptRoles = user.department_roles || [];

    return (
        <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Шапка карточки */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 dark:bg-neutral-950"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3">
                    {/* Аватар-заглушка */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                          text-blue-700 font-semibold text-sm shrink-0">
                        {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{user.email}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Бейджи ролей */}
                    <div className="flex gap-1 flex-wrap justify-end">
                        {deptRoles.length === 0 ? (
                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">нет ролей</span>
                        ) : (
                            deptRoles.slice(0, 2).map(dr => (
                                <span key={dr.id}
                                    className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    {dr.department_name}
                                </span>
                            ))
                        )}
                        {deptRoles.length > 2 && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">+{deptRoles.length - 2}</span>
                        )}
                    </div>

                    {/* Статус подтверждения */}
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${user.is_confirmed
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                        }`}>
                        {user.is_confirmed ? 'активен' : 'ожидает'}
                    </span>

                    <span className="text-gray-400 dark:text-gray-500 text-sm">{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {/* Раскрытая часть */}
            {expanded && (
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-neutral-50 dark:bg-neutral-950">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            Роли в подразделениях
                        </span>
                        <button
                            onClick={() => setModal(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs
                         px-3 py-1.5 rounded-lg transition-colors">
                            + Назначить роль
                        </button>
                    </div>

                    {deptRoles.length === 0 ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 py-2">
                            Роли не назначены. Пользователь не может работать в системе.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {deptRoles.map(dr => (
                                <div key={dr.id}
                                    className="flex items-center justify-between bg-white dark:bg-neutral-900 border
                             border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                {dr.department_name}
                                            </span>
                                            <span className="text-gray-400 dark:text-gray-500 mx-1.5">→</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{dr.role_name}</span>
                                            {dr.can_approve && (
                                                <span className="ml-2 text-xs bg-amber-50 text-amber-700
                                         px-1.5 py-0.5 rounded">
                                                    может утверждать
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveRole(dr.id)}
                                        disabled={removing === dr.id}
                                        className="text-xs text-red-500 hover:text-red-700 px-2 py-1
                               hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                                        {removing === dr.id ? '...' : 'Снять'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Дата регистрации */}
                    <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                        Зарегистрирован: {new Date(user.date_joined).toLocaleDateString('ru-RU')}
                    </div>
                </div>
            )}

            {/* Модалка назначения */}
            {modal && (
                <Modal title={`Назначить роль — ${user.full_name}`} onClose={() => setModal(false)}>
                    <AssignRoleForm
                        userId={user.id}
                        departments={departments}
                        roles={roles}
                        existingRoles={deptRoles}
                        onSave={() => { onUpdate(); }}
                        onClose={() => setModal(false)}
                    />
                </Modal>
            )}
        </div>
    );
}
