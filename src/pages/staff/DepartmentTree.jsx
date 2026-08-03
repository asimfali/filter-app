// ── Дерево подразделений ──────────────────────────────────────────────────

export default function DepartmentTree({ departments, level = 0, onEdit, onAdd }) {
    return (
        <div className={level > 0 ? 'border-l border-gray-200 dark:border-gray-700 ml-4' : ''}>
            {departments.map(dept => (
                <div key={dept.id}>
                    <div
                        className="flex items-center justify-between px-3 py-2 rounded-lg
                                   hover:bg-neutral-50 dark:hover:bg-neutral-800 group
                                   border-b border-gray-100 dark:border-gray-800"
                        style={{ paddingLeft: `${level * 16 + 12}px` }}
                    >
                        <div className="flex items-center gap-2">
                            {level > 0 && (
                                <span className="text-gray-300 dark:text-gray-600 text-xs select-none">
                                    └
                                </span>
                            )}
                            <div>
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                    {dept.name}
                                </span>
                                <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                                    {dept.code}
                                </span>
                                {dept.members_count > 0 && (
                                    <span className="ml-2 text-xs bg-blue-50 dark:bg-blue-900/30
                                                     text-blue-600 dark:text-blue-400
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
