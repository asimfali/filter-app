import { useState } from 'react';
import { useDeptPermissions, useAllPermissions } from '../../hooks/useStaff';
import CreatePermissionModal, { RESOURCE_TYPES } from './CreatePermissionModal';
import PermissionToggleCell from './PermissionToggleCell';

const RESOURCE_LABELS = Object.fromEntries(RESOURCE_TYPES.map(r => [r.value, r.label]));

export default function DeptPermissionsTab({ deptId, roles }) {
    const { perms, loading, add, remove } = useDeptPermissions(deptId);
    const [busy, setBusy] = useState(null);
    const [search, setSearch] = useState('');
    const [collapsed, setCollapsed] = useState({});
    const [createModal, setCreateModal] = useState(false);
    const [permissions, setPermissions] = useState(null);

    const isEnabled = (roleId, permId) =>
        perms.some(p => p.role === roleId && p.permission === permId);

    const getPermId = (roleId, permId) =>
        perms.find(p => p.role === roleId && p.permission === permId)?.id;

    const toggle = async (roleId, permId) => {
        const key = `${roleId}-${permId}`;
        setBusy(key);
        if (isEnabled(roleId, permId)) {
            await remove(getPermId(roleId, permId));
        } else {
            await add(roleId, permId);
        }
        setBusy(null);
    };

    const toggleGroup = (group) =>
        setCollapsed(prev => ({ ...prev, [group]: !prev[group] }));

    const basePermissions = useAllPermissions();
    const allPermissions = permissions ?? basePermissions;

    const handleCreated = (newPerm) => {
        setPermissions(prev => [...(prev ?? basePermissions), newPerm]);
    };
    // Фильтрация + группировка
    const filtered = allPermissions.filter(p => {
        const q = search.toLowerCase();
        return !q || p.code.toLowerCase().includes(q) || p.name?.toLowerCase().includes(q);
    });

    const grouped = filtered.reduce((acc, perm) => {
        const group = perm.resource_type || 'other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(perm);
        return acc;
    }, {});

    if (loading) return (
        <div className="text-xs text-gray-400 py-4 text-center">Загрузка...</div>
    );
    if (!allPermissions.length || !roles.length) return (
        <div className="text-xs text-gray-400 py-4 text-center">Нет данных</div>
    );

    return (
        <div className="space-y-2">
            {/* Поиск */}
            <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Поиск по коду или названию..."
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg
                           px-3 py-1.5 text-xs focus:outline-none focus:ring-2
                           focus:ring-blue-500 dark:bg-neutral-800 dark:text-white"
            />
            <button
                    onClick={() => setCreateModal(true)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white
                               text-xs px-3 py-1.5 rounded-lg transition-colors">
                    + Новое право
                </button>

            <div className="overflow-auto max-h-[420px]">
                {Object.entries(grouped).map(([group, perms]) => (
                    <div key={group} className="mb-1">
                        {/* Заголовок группы */}
                        <button
                            onClick={() => toggleGroup(group)}
                            className="w-full flex items-center justify-between px-2 py-1.5
                                       bg-neutral-100 dark:bg-neutral-800 rounded text-xs
                                       font-medium text-gray-600 dark:text-gray-400
                                       hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            <span>{RESOURCE_LABELS[group] ?? group}</span>
                            <span className="flex items-center gap-2">
                                <span className="text-gray-400">{perms.length}</span>
                                <span>{collapsed[group] ? '▸' : '▾'}</span>
                            </span>
                        </button>

                        {/* Таблица группы */}
                        {!collapsed[group] && (
                            <table className="w-full text-xs border-collapse mt-0.5">
                                <thead>
                                    <tr>
                                        <th className="text-left px-2 py-1 text-gray-400 font-normal
                                                       border-b border-gray-100 dark:border-gray-800 min-w-48">
                                            Право
                                        </th>
                                        {roles.map(r => (
                                            <th key={r.id}
                                                className="px-2 py-1 text-center text-gray-500
                                                           dark:text-gray-400 font-normal
                                                           border-b border-gray-100 dark:border-gray-800 min-w-20">
                                                {r.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {perms.map(perm => (
                                        <tr key={perm.id}
                                            className="hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                                            <td className="px-2 py-1.5 border-b border-gray-100 dark:border-gray-800">
                                                <div className="font-mono text-gray-700 dark:text-gray-300">
                                                    {perm.code}
                                                </div>
                                                {perm.name && (
                                                    <div className="text-gray-400 dark:text-gray-500 text-[11px]">
                                                        {perm.name}
                                                    </div>
                                                )}
                                            </td>
                                            {roles.map(role => {
                                                const key = `${role.id}-${perm.id}`;
                                                return (
                                                    <PermissionToggleCell key={role.id}
                                                        enabled={isEnabled(role.id, perm.id)}
                                                        busy={busy === key}
                                                        onToggle={() => toggle(role.id, perm.id)} />
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-4">
                        Ничего не найдено
                    </div>
                )}
                {createModal && (
                <CreatePermissionModal
                    onClose={() => setCreateModal(false)}
                    onCreated={handleCreated}
                />
            )}
            </div>
        </div>
    );
}
