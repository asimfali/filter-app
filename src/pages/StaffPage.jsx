import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../api/auth';

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

// ── Модальное окно ────────────────────────────────────────────────────────

function Modal({ title, onClose, children, wide }) {
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">{title}</h3>
                    <button onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
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

    const sel = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Подразделение</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Роль</label>
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
                    className="flex-1 border border-gray-300 text-gray-700 text-sm py-2 rounded-lg hover:bg-gray-50">
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
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Шапка карточки */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(e => !e)}
            >
                <div className="flex items-center gap-3">
                    {/* Аватар-заглушка */}
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center
                          text-blue-700 font-semibold text-sm shrink-0">
                        {(user.first_name?.[0] || user.username?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                        <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Бейджи ролей */}
                    <div className="flex gap-1 flex-wrap justify-end">
                        {deptRoles.length === 0 ? (
                            <span className="text-xs text-gray-400 italic">нет ролей</span>
                        ) : (
                            deptRoles.slice(0, 2).map(dr => (
                                <span key={dr.id}
                                    className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                                    {dr.department_name}
                                </span>
                            ))
                        )}
                        {deptRoles.length > 2 && (
                            <span className="text-xs text-gray-400">+{deptRoles.length - 2}</span>
                        )}
                    </div>

                    {/* Статус подтверждения */}
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${user.is_confirmed
                        ? 'bg-green-50 text-green-700'
                        : 'bg-amber-50 text-amber-700'
                        }`}>
                        {user.is_confirmed ? 'активен' : 'ожидает'}
                    </span>

                    <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {/* Раскрытая часть */}
            {expanded && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
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
                        <p className="text-xs text-gray-400 py-2">
                            Роли не назначены. Пользователь не может работать в системе.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {deptRoles.map(dr => (
                                <div key={dr.id}
                                    className="flex items-center justify-between bg-white border
                             border-gray-200 rounded-lg px-3 py-2">
                                    <div className="flex items-center gap-3">
                                        <div>
                                            <span className="text-sm font-medium text-gray-800">
                                                {dr.department_name}
                                            </span>
                                            <span className="text-gray-400 mx-1.5">→</span>
                                            <span className="text-sm text-gray-700">{dr.role_name}</span>
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
                    <div className="mt-2 text-xs text-gray-400">
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
                         hover:bg-gray-50 group"
              style={{ paddingLeft: `${level * 20 + 12}px` }}
            >
              <div className="flex items-center gap-2">
                {level > 0 && <span className="text-gray-300 text-xs">└</span>}
                <div>
                  <span className="text-sm font-medium text-gray-800">{dept.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{dept.code}</span>
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

    const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm " +
        "focus:outline-none focus:ring-2 focus:ring-blue-500";

    const modalTitle = modal?.id
        ? `Редактировать: ${modal.name}`
        : modal?._parent
            ? `Новое подразделение в «${modal._parent.name}»`
            : 'Новое корневое подразделение';

    return (
        <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-800">Структура подразделений</span>
                <button onClick={() => openAdd(null)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs
                       px-2.5 py-1.5 rounded-lg transition-colors">
                    + Добавить корневое
                </button>
            </div>

            {departments.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Нет подразделений</p>
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">Название</label>
                            <input required value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Бюро автоматики" className={inp} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                Код <span className="text-gray-400 font-normal">(латиница)</span>
                            </label>
                            <input required value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                                placeholder="ba" className={inp} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Описание</label>
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
                                className="flex-1 border border-gray-300 text-gray-700 text-sm
                             py-2 rounded-lg hover:bg-gray-50">Отмена</button>
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

// ── Главная страница ──────────────────────────────────────────────────────

export default function StaffPage() {
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState('users');
    const { departments, reload: reloadDepts } = useDepartments();
    const roles = useRoles();
    const { users, loading, reload: reloadUsers } = useUsers(search);

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-lg shadow px-5 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900">Управление персоналом</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Назначайте сотрудников в подразделения и управляйте ролями
                    </p>
                </div>
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                    {[
                        { id: 'users', label: 'Сотрудники' },
                        { id: 'departments', label: 'Подразделения' },
                    ].map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`px-4 py-1.5 rounded text-sm transition-colors ${tab === t.id
                                    ? 'bg-white text-gray-900 shadow-sm font-medium'
                                    : 'text-gray-600 hover:text-gray-800'
                                }`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === 'users' && (
                <>
                    <div className="bg-white rounded-lg shadow px-4 py-3">
                        <input type="search" value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Поиск по имени, фамилии, email..."
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {loading ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                            Загрузка...
                        </div>
                    ) : users.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                            {search ? 'Ничего не найдено' : 'Нет пользователей'}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="text-xs text-gray-500 px-1">
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

            {tab === 'departments' && (
                <DepartmentsPanel departments={departments} reload={reloadDepts} />
            )}
        </div>
    );
}