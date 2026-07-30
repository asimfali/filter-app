import UserCard from './UserCard';

// ── Вкладка "Сотрудники" ──────────────────────────────────────────────────

export default function UsersPanel({ search, onSearchChange, users, loading, departments, roles, onUpdate }) {
    return (
        <>
            <div className="bg-white dark:bg-neutral-900 rounded-lg shadow px-4 py-3">
                <input type="search" value={search}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Поиск по имени, фамилии, email..."
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-blue-500
                               dark:bg-neutral-800 dark:text-white" />
            </div>

            {loading ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    Загрузка...
                </div>
            ) : users.length === 0 ? (
                <div className="bg-white dark:bg-neutral-900 rounded-lg shadow p-8 text-center text-gray-400 text-sm">
                    {search ? 'Ничего не найдено' : 'Нет пользователей'}
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
                        Найдено: {users.length} сотрудников
                    </div>
                    {users.map(user => (
                        <UserCard key={user.id} user={user}
                            departments={departments}
                            roles={roles}
                            onUpdate={onUpdate} />
                    ))}
                </div>
            )}
        </>
    );
}
