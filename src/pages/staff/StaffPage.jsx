import { useState } from 'react';
import { can, PERM } from '../../utils/permissions';
import { useAuth } from '../../contexts/AuthContext';
import { useDepartments, useRoles, useUsers, useStaffRequests } from '../../hooks/useStaff';
import UsersPanel from './UsersPanel';
import StaffRequestsPanel from './StaffRequestsPanel';
import DepartmentsPanel from './DepartmentsPanel';

// ── Главная страница ──────────────────────────────────────────────────────

export default function StaffPage() {
    const [search, setSearch] = useState('');
    const { departments, flat, reload: reloadDepts } = useDepartments();
    const roles = useRoles();
    const { users, loading: usersLoading, reload: reloadUsers } = useUsers(search);
    const { requests, loading: requestsLoading, reload: reloadRequests } = useStaffRequests();
    const { user } = useAuth();

    // Счётчик pending для badge
    const pendingCount = requests.filter(r => r.status === 'pending').length;

    const ALL_TABS = [
        { id: 'users', label: 'Сотрудники', code: PERM.PORTAL_STAFF_USERS },
        { id: 'requests', label: 'Заявки', code: PERM.PORTAL_STAFF_REQUESTS, badge: pendingCount },
        { id: 'departments', label: 'Подразделения', code: PERM.PORTAL_STAFF_DEPARTMENTS },
    ];

    const visibleTabs = ALL_TABS.filter(t => can(user, t.code));
    const [tab, setTab] = useState(() => visibleTabs[0]?.id || '');

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-5 py-4 flex items-center justify-between">
                <div>
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                        Управление персоналом
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        Назначайте сотрудников в подразделения и управляйте ролями
                    </p>
                </div>
                <div className="flex gap-1 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-lg">
                    {visibleTabs.map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`relative px-4 py-1.5 rounded text-sm transition-colors ${tab === t.id
                                ? 'bg-white dark:bg-neutral-900 text-gray-900 dark:text-white shadow-sm font-medium'
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
                <UsersPanel
                    search={search}
                    onSearchChange={setSearch}
                    users={users}
                    loading={usersLoading}
                    departments={flat}
                    roles={roles}
                    onUpdate={reloadUsers}
                />
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
