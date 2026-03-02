import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/auth';
import { can } from '../utils/permissions';
import { useAuth } from '../contexts/AuthContext';

const API = '/api/v1/auth';

// ── Утилиты ───────────────────────────────────────────────────────────────

function parseError(data, status) {
    if (status === 403) return data?.detail || 'Недостаточно прав';
    if (data?.detail) return data.detail;
    if (typeof data === 'object') return Object.values(data).flat().join(', ');
    return 'Неизвестная ошибка';
}

// ── Хуки ─────────────────────────────────────────────────────────────────

function useDepartments() {
    const [departments, setDepartments] = useState([]);
    const load = useCallback(async () => {
        // root_only=true — бэкенд вернёт корневые с вложенными children
        const res = await apiFetch(`${API}/departments/?root_only=true`);
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : (data.results || []));
    }, []);
    useEffect(() => { load(); }, [load]);
    return { departments, reload: load };
}

function useRoles() {
    const [roles, setRoles] = useState([]);
    useEffect(() => {
        apiFetch(`${API}/roles/`)
            .then(r => r.json())
            .then(data => setRoles(Array.isArray(data) ? data : (data.results || [])));
    }, []);
    return roles;
}

function useUsers(search = '') {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const q = search ? `?search=${encodeURIComponent(search)}` : '';
        const res = await apiFetch(`${API}/users-list/${q}`);
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : (data.results || []));
        setLoading(false);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(load, 300);
        return () => clearTimeout(t);
    }, [load]);

    return { users, loading, reload: load };
}

function useStaffRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async (status = 'pending') => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API}/staff-requests/?status=${status}`);
            const data = await res.json();
            setRequests(Array.isArray(data) ? data : (data.results || []));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load('pending'); }, [load]);

    return { requests, loading, reload: load };
}

// ── Модальное окно ────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                    <button onClick={onClose}
                        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 text-xl leading-none">✕</button>
                </div>
                <div className="px-5 py-4">{children}</div>
            </div>
        </div>
    );
}

// ── Форма назначения роли ─────────────────────────────────────────────────

function AssignRoleForm({ userId, departments, roles, existingRoles, onSave, onClose }) {
    const [form, setForm] = useState({ department: '', role: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Фильтруем уже назначенные комбинации
    const isAlreadyAssigned = (deptId, roleId) =>
        existingRoles.some(r => r.department === deptId && r.role === roleId);

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

    const sel = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Подразделение</label>
                <select required value={form.department}
                    onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                    className={sel}>
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
                    className={sel}>
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
                    className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">
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

function UserCard({ user, departments, roles, onUpdate }) {
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
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Шапка карточки */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950"
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
                <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-950">
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
                                    className="flex items-center justify-between bg-white dark:bg-gray-900 border
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

// ── Дерево подразделений ──────────────────────────────────────────────────

function DepartmentTree({ departments, level = 0, onEdit, onAdd }) {
    return (
        <div>
            {departments.map(dept => (
                <div key={dept.id}>
                    <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg
                       hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950 group"
                        style={{ paddingLeft: `${level * 20 + 12}px` }}
                    >
                        <div className="flex items-center gap-2">
                            {level > 0 && <span className="text-gray-300 text-xs">└</span>}
                            <div>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{dept.name}</span>
                                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">{dept.code}</span>
                                {dept.members_count > 0 && (
                                    <span className="ml-2 text-xs bg-blue-50 text-blue-600
                                   px-1.5 py-0.5 rounded-full">
                                        {dept.members_count} чел.
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onAdd(dept)}
                                className="text-xs text-emerald-600 hover:text-emerald-800
                           px-2 py-1 hover:bg-emerald-50 rounded">
                                + дочернее
                            </button>
                            <button onClick={() => onEdit(dept)}
                                className="text-xs text-blue-600 hover:text-blue-800
                           px-2 py-1 hover:bg-blue-50 rounded">
                                ✎
                            </button>
                        </div>
                    </div>
                    {dept.children?.length > 0 && (
                        <DepartmentTree
                            departments={dept.children}
                            level={level + 1}
                            onEdit={onEdit}
                            onAdd={onAdd}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Панель подразделений (новая версия с иерархией) ───────────────────────

function DepartmentsPanel({ departments, reload }) {
    const [modal, setModal] = useState(null);
    const [form, setForm] = useState({ name: '', code: '', description: '', parent: null });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const openAdd = (parentDept = null) => {
        setForm({ name: '', code: '', description: '', parent: parentDept?.id || null });
        setModal({ _parent: parentDept });
        setError('');
    };

    const openEdit = (dept) => {
        setForm({ name: dept.name, code: dept.code, description: dept.description || '', parent: dept.parent || null });
        setModal(dept);
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

    const inp = "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white dark:border-gray-600";

    const modalTitle = modal?.id
        ? `Редактировать: ${modal.name}`
        : modal?._parent
            ? `Новое подразделение в «${modal._parent.name}»`
            : 'Новое корневое подразделение';

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Структура подразделений</span>
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
                <Modal title={modalTitle} onClose={() => setModal(null)}>
                    <form onSubmit={handleSubmit} className="space-y-3">
                        {form.parent && modal?._parent && (
                            <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg">
                                Родитель: <strong>{modal._parent.name}</strong>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Название</label>
                            <input required value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Бюро автоматики" className={inp} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">
                                Код <span className="text-gray-400 dark:text-gray-500 font-normal">(латиница)</span>
                            </label>
                            <input required value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                placeholder="ba" className={inp} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-1">Описание</label>
                            <input value={form.description}
                                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                placeholder="Необязательно" className={inp} />
                        </div>
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs
                                px-3 py-2 rounded-lg">{error}</div>
                        )}
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setModal(null)}
                                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm
                             py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-950">Отмена</button>
                            <button type="submit" disabled={loading}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50
                             text-white text-sm py-2 rounded-lg">
                                {loading ? 'Сохранение...' : 'Сохранить'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

function StaffRequestsPanel({ requests, loading, onReload }) {
    const [processing, setProcessing] = useState(null); // id заявки в процессе
    const [rejectModal, setRejectModal] = useState(null); // { id, userName }
    const [comment, setComment] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending');

    const handleApprove = async (id) => {
        setProcessing(id);
        try {
            await apiFetch(`${API}/staff-requests/${id}/approve/`, { method: 'POST' });
            onReload(statusFilter);
        } catch {
            // ошибка — можно добавить toast
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async () => {
        setProcessing(rejectModal.id);
        try {
            await apiFetch(`${API}/staff-requests/${rejectModal.id}/reject/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment }),
            });
            setRejectModal(null);
            setComment('');
            onReload(statusFilter);
        } catch {
            // ошибка
        } finally {
            setProcessing(null);
        }
    };

    const STATUS_LABEL = {
        pending: 'Ожидают',
        approved: 'Одобренные',
        rejected: 'Отклонённые',
    };

    const STATUS_BADGE = {
        pending: 'bg-amber-50 text-amber-700',
        approved: 'bg-green-50 text-green-700',
        rejected: 'bg-red-50 text-red-700',
    };

    return (
        <div className="space-y-3">
            {/* Фильтр по статусу */}
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-4 py-3 flex gap-1">
                {Object.entries(STATUS_LABEL).map(([s, label]) => (
                    <button key={s} onClick={() => { setStatusFilter(s); onReload(s); }}
                        className={`px-3 py-1.5 rounded text-sm transition-colors ${statusFilter === s
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}>
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    Загрузка...
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    {statusFilter === 'pending' ? 'Нет новых заявок' : 'Нет заявок'}
                </div>
            ) : (
                <div className="space-y-2">
                    {requests.map(r => (
                        <div key={r.id}
                            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                                       rounded-lg px-4 py-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Аватар */}
                                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                                                text-blue-700 font-semibold text-sm shrink-0">
                                    {(r.user_name?.[0] || '?').toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                        {r.user_name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {r.user_email}
                                    </div>
                                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                        {r.dept_name} → {r.role_name}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {new Date(r.created_at).toLocaleDateString('ru-RU')}
                                </span>

                                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>
                                    {STATUS_LABEL[r.status]}
                                </span>

                                {r.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => handleApprove(r.id)}
                                            disabled={processing === r.id}
                                            className="bg-green-600 hover:bg-green-700 disabled:opacity-50
                                                       text-white text-xs px-3 py-1.5 rounded-lg transition-colors">
                                            {processing === r.id ? '...' : 'Принять'}
                                        </button>
                                        <button
                                            onClick={() => { setRejectModal({ id: r.id, userName: r.user_name }); setComment(''); }}
                                            disabled={processing === r.id}
                                            className="border border-red-300 text-red-600 hover:bg-red-50
                                                       text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                                            Отклонить
                                        </button>
                                    </>
                                )}

                                {r.status === 'rejected' && r.comment && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic max-w-32 truncate"
                                        title={r.comment}>
                                        {r.comment}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Модалка отклонения */}
            {rejectModal && (
                <Modal title={`Отклонить заявку — ${rejectModal.userName}`}
                    onClose={() => setRejectModal(null)}>
                    <div className="space-y-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Укажите причину отклонения (необязательно):
                        </p>
                        <textarea
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                            rows={3}
                            placeholder="Причина..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2
                                       text-sm focus:outline-none focus:ring-2 focus:ring-red-400
                                       dark:bg-gray-800 dark:text-white resize-none"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => setRejectModal(null)}
                                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300
                                           text-sm py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                                Отмена
                            </button>
                            <button onClick={handleReject} disabled={processing === rejectModal.id}
                                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50
                                           text-white text-sm py-2 rounded-lg transition-colors">
                                {processing === rejectModal.id ? '...' : 'Отклонить'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}

// ── Главная страница ──────────────────────────────────────────────────────

export default function StaffPage() {
    const [search, setSearch] = useState('');
    const { departments, reload: reloadDepts } = useDepartments();
    const roles = useRoles();
    const { users, loading: usersLoading, reload: reloadUsers } = useUsers(search);
    const { requests, loading: requestsLoading, reload: reloadRequests } = useStaffRequests();
    const { user } = useAuth();

    // Счётчик pending для badge
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    const ALL_TABS = [
        { id: 'users', label: 'Сотрудники', code: 'portal.staff.users' },
        { id: 'requests', label: 'Заявки', code: 'portal.staff.requests', badge: pendingCount },
        { id: 'departments', label: 'Подразделения', code: 'portal.staff.departments' },
    ];

    const visibleTabs = ALL_TABS.filter(t => can(user, t.code));
    const [tab, setTab] = useState(() => visibleTabs[0]?.id || '');

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-5 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Управление персоналом
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Назначайте сотрудников в подразделения и управляйте ролями
                    </p>
                </div>
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                    {visibleTabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`relative px-4 py-1.5 rounded text-sm transition-colors ${tab === t.id
                                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm font-medium'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-800'
                                }`}>
                            {t.label}
                            {t.badge > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white
                                                 text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {t.badge > 9 ? '9+' : t.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'users' && (
                <>
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow px-4 py-3">
                        <input type="search" value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по имени, фамилии, email..."
                            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                                       focus:outline-none focus:ring-2 focus:ring-blue-500
                                       dark:bg-gray-800 dark:text-white" />
                    </div>

                    {usersLoading ? (
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                            Загрузка...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                            {search ? 'Ничего не найдено' : 'Нет пользователей'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                                Найдено: {users.length} сотрудников
                            </div>
                            {users.map(user => (
                                <UserCard key={user.id} user={user}
                                    departments={departments} roles={roles}
                                    onUpdate={reloadUsers} />
                            ))}
                        </div>
                    )}
                </>
            )}

            {tab === 'requests' && (
                <StaffRequestsPanel
                    requests={requests}
                    loading={requestsLoading}
                    onReload={reloadRequests}
                />
            )}

            {tab === 'departments' && (
                <DepartmentsPanel departments={departments} reload={reloadDepts} />
            )}
        </div>
    );
}